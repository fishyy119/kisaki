/**
 * Shared media scanner handler.
 *
 * Owns everything a scan does regardless of media type: run queueing and
 * controls, interval scheduling, directory discovery, per-entity guards, and
 * ingest-mode policy. A media handler only says how its entity is looked up,
 * added, and finished.
 */

import { promises as fs } from 'node:fs'
import { eq } from 'drizzle-orm'

import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { IpcService } from '@main/services/ipc'
import type { TaskRunService } from '@main/services/task-run'
import type { MediaType } from '@shared/common'
import {
  scanners,
  scraperProfiles,
  type Scanner,
  type ScannerIngestMode,
  type ScraperProfile
} from '@shared/db'
import type { ExistingReason, IngestWarning } from '@shared/ingest/common'
import type {
  EntityEntry,
  ScanCompletedData,
  ScannerRunState,
  ScannerRunStartResult
} from '@shared/scanner'
import type { TaskRunInitiator } from '@shared/task-run'
import type { ScannerDiscovery } from '../../discovery'
import type { ScannerHooks } from '../../hooks'
import { ScannerRunCoordinator } from './coordinator'
import {
  createError,
  createExisting,
  createIngestWarnings,
  createScannedEntity,
  createWarning,
  getScraperProblemType,
  isMissingMetadataScraperFailure,
  isRecoverableScraperFailure
} from './issues'
import type { ScannerRunSession } from './session'
import type { ScannerEntityError, ScannerEntityProcessResult, ScannerEntityWarning } from './types'

const log = createLogger('Scanner')

/** Identity resolved for one discovered directory before it is added. */
export interface ScannerEntityMatch {
  name: string
  externalIds: Array<{ source: string; id: string }>
}

export interface ScannerAddOptions {
  entityPath: string
  targetCollectionId?: string
  signal: AbortSignal
}

/** Media-neutral projection of an ingest add result. */
export interface ScannerAddOutcome {
  entityId: string
  isNew: boolean
  existingReason?: ExistingReason
  warnings?: IngestWarning[]
}

export interface MediaScannerHandlerDeps {
  discovery: ScannerDiscovery
  dbService: DbService
  ipcService: IpcService
  hooks: ScannerHooks
  taskRunService: TaskRunService
  i18nService: I18nService
}

type AddOutcome =
  | { kind: 'added'; result: ScannerAddOutcome; warnings?: ScannerEntityWarning[] }
  | { kind: 'failed'; errors: ScannerEntityError[] }

function assertNever(value: never): never {
  throw new Error(`Unsupported scanner ingest mode: ${String(value)}`)
}

export abstract class MediaScannerHandler {
  protected readonly discovery: ScannerDiscovery
  protected readonly dbService: DbService
  protected readonly hooks: ScannerHooks
  protected readonly i18nService: I18nService

  private readonly scheduledScanners = new Map<string, NodeJS.Timeout>()
  private readonly runs: ScannerRunCoordinator<Scanner>

  constructor(
    protected readonly mediaType: MediaType,
    deps: MediaScannerHandlerDeps
  ) {
    this.discovery = deps.discovery
    this.dbService = deps.dbService
    this.hooks = deps.hooks
    this.i18nService = deps.i18nService

    this.runs = new ScannerRunCoordinator<Scanner>({
      ipc: deps.ipcService,
      taskRun: deps.taskRunService,
      hooks: deps.hooks,
      i18n: deps.i18nService,
      loadScanner: async (scannerId) => this.loadScanner(scannerId),
      runScan: async (scanner, session) => this.runScannerScan(scanner, session)
    })
  }

  // ---------------------------------------------------------------------------
  // Media contract
  // ---------------------------------------------------------------------------

  /** Existing entry already claiming this directory, if any. */
  protected abstract findExistingByPath(path: string): { id: string; name: string } | undefined

  protected abstract addDirect(
    match: ScannerEntityMatch,
    options: ScannerAddOptions
  ): Promise<ScannerAddOutcome>

  protected abstract addFromScraper(
    profileId: string,
    match: ScannerEntityMatch,
    options: ScannerAddOptions
  ): Promise<ScannerAddOutcome>

  /**
   * Work that runs after an entry exists, such as attaching its media files.
   * Returns warnings to attach to the entity result.
   */
  protected async finalizeEntity(
    _entityId: string,
    _entity: EntityEntry,
    _signal: AbortSignal
  ): Promise<ScannerEntityWarning[]> {
    return []
  }

  // ---------------------------------------------------------------------------
  // Run controls
  // ---------------------------------------------------------------------------

  async runScanner(
    scannerId: string,
    initiator: TaskRunInitiator = { type: 'user' }
  ): Promise<ScanCompletedData> {
    return this.runs.runScanner(scannerId, initiator)
  }

  async startScanner(
    scannerId: string,
    initiator: TaskRunInitiator = { type: 'user' }
  ): Promise<ScannerRunStartResult> {
    const { start, completed } = await this.runs.startScanner(scannerId, initiator)
    void completed.catch((error) => {
      log.error('Scanner run failed after start.', { scannerId, error })
    })
    return start
  }

  listRunStates(): ScannerRunState[] {
    return this.runs.listRunStates()
  }

  pauseScanner(scannerId: string): boolean {
    return this.runs.pauseScanner(scannerId)
  }

  resumeScanner(scannerId: string): boolean {
    return this.runs.resumeScanner(scannerId)
  }

  cancelScanner(scannerId: string): boolean {
    return this.runs.cancelScanner(scannerId)
  }

  async startAllScanners(
    initiator: TaskRunInitiator = { type: 'user' }
  ): Promise<ScannerRunStartResult[]> {
    const starts: ScannerRunStartResult[] = []

    for (const scanner of this.listMediaScanners()) {
      try {
        starts.push(await this.startScanner(scanner.id, initiator))
      } catch (error) {
        log.error('Failed to start scanner.', { scannerName: scanner.name, error })
      }
    }

    return starts
  }

  // ---------------------------------------------------------------------------
  // Scheduling
  // ---------------------------------------------------------------------------

  async scheduleScanner(scannerId: string): Promise<void> {
    this.unscheduleScanner(scannerId)

    const scanner = this.getScannerById(scannerId)
    if (!scanner) {
      log.error('Cannot schedule scanner: not found.', { scannerId })
      return
    }

    if (scanner.type !== this.mediaType) {
      log.warn('Scanner media type does not match handler, cannot schedule.', {
        scannerName: scanner.name,
        mediaType: this.mediaType
      })
      return
    }

    if (scanner.scanIntervalMinutes <= 0) {
      log.info('Scanner scan interval disabled, not scheduling.', {
        scannerName: scanner.name,
        scannerScanIntervalMinutes: scanner.scanIntervalMinutes
      })
      return
    }

    log.info('Scheduling scanner.', {
      scannerName: scanner.name,
      scannerScanIntervalMinutes: scanner.scanIntervalMinutes
    })

    const intervalId = setInterval(
      () => {
        log.info('Running scheduled scan for scanner.', { scannerName: scanner.name })
        void this.runScanner(scannerId, { type: 'system', reason: 'maintenance' }).catch(
          (error) => {
            log.error('Scheduled scan failed for scanner.', { scannerName: scanner.name, error })
          }
        )
      },
      scanner.scanIntervalMinutes * 60 * 1000
    )

    this.scheduledScanners.set(scannerId, intervalId)
  }

  unscheduleScanner(scannerId: string): void {
    const intervalId = this.scheduledScanners.get(scannerId)
    if (!intervalId) return

    clearInterval(intervalId)
    this.scheduledScanners.delete(scannerId)
    log.info('Unscheduled scanner.', { scannerId })
  }

  async scheduleAllScanners(): Promise<void> {
    log.info('Scheduling all scanners with intervals', { mediaType: this.mediaType })

    for (const scanner of this.listMediaScanners()) {
      await this.scheduleScanner(scanner.id)
    }
  }

  unscheduleAllScanners(): void {
    for (const scannerId of [...this.scheduledScanners.keys()]) {
      this.unscheduleScanner(scannerId)
    }
  }

  getScheduledScannerIds(): string[] {
    return [...this.scheduledScanners.keys()]
  }

  isScannerScheduled(scannerId: string): boolean {
    return this.scheduledScanners.has(scannerId)
  }

  cleanup(): void {
    this.unscheduleAllScanners()
    this.runs.cleanup()
  }

  // ---------------------------------------------------------------------------
  // Scan execution
  // ---------------------------------------------------------------------------

  private async runScannerScan(
    scanner: Scanner,
    session: ScannerRunSession<Scanner>
  ): Promise<void> {
    const {
      scannerIgnoredNames: ignoredNames,
      scannerParallelCount,
      scannerIngestMode: ingestMode
    } = this.dbService.settings.get()

    const profile = this.getScraperProfile(scanner.scraperProfileId)
    if (!profile && ingestMode !== 'direct-only') {
      log.warn('Scanner has no scraper profile.', {
        scannerName: scanner.name,
        ingestMode
      })
    }

    log.info('Starting scan.', {
      mediaType: this.mediaType,
      scannerName: scanner.name,
      scannerPath: scanner.path,
      scannerEntityDepth: scanner.entityDepth,
      ingestMode,
      scannerParallelCount,
      profileName: profile?.name ?? 'none'
    })

    session.reportPhase('discovering', this.i18nService.messages.scanner.run.discovering, true)
    await session.checkpoint()

    const discoveredEntries = await this.discovery.scanForEntities(scanner.path, {
      entityDepth: scanner.entityDepth,
      ignoredNames,
      nameExtractionRules: scanner.nameExtractionRules
    })

    const entities: EntityEntry[] = []
    for (const entry of discoveredEntries) {
      const discovered = await this.hooks.entryDiscovered.transform({
        mediaType: this.mediaType,
        entry,
        skip: false
      })
      if (!discovered.skip) {
        entities.push(discovered.entry)
      }
    }
    await session.checkpoint()

    log.info('Found entities at depth.', {
      entitiesLength: entities.length,
      scannerEntityDepth: scanner.entityDepth
    })

    session.reportPhase('processing', this.i18nService.messages.scanner.run.processing)
    session.setTotal(entities.length)
    await session.processItemsWithConcurrency(entities, scannerParallelCount, async (entity) => {
      session.recordEntityResult(
        await this.processEntity(entity, {
          scanner,
          profile,
          ingestMode,
          signal: session.signal
        })
      )
    })

    log.info('Scan completed.', {
      mediaType: this.mediaType,
      newCount: session.state.newCount,
      existingCount: session.state.existingCount,
      failedCount: session.state.failedCount,
      issueCount: session.state.issueCount
    })
  }

  private async processEntity(
    entity: EntityEntry,
    options: {
      scanner: Scanner
      profile: ScraperProfile | null
      ingestMode: ScannerIngestMode
      signal: AbortSignal
    }
  ): Promise<ScannerEntityProcessResult> {
    const reasons = this.i18nService.messages.scanner.run.reasons

    try {
      const directoryError = await this.checkScannableDirectory(entity)
      if (directoryError) {
        return { ...createScannedEntity(entity), kind: 'failed', errors: [directoryError] }
      }

      const existingByPath = this.findExistingByPath(entity.path)
      if (existingByPath) {
        log.info('Entry already exists at path.', {
          entityPath: entity.path,
          existingName: existingByPath.name
        })
        return { kind: 'existing', existing: createExisting(entity, existingByPath.id) }
      }

      // The built-in baseline is the extracted folder name; hook subscribers
      // (such as the built-in pHash match extension) may upgrade the match.
      const matched = await this.hooks.entryMatched.transform({
        mediaType: this.mediaType,
        entry: entity,
        name: entity.extractedName,
        externalIds: [],
        matchSource: 'folder-name'
      })
      const outcome = await this.addEntity(
        { name: matched.name, externalIds: matched.externalIds },
        {
          entityPath: entity.path,
          targetCollectionId: options.scanner.targetCollectionId || undefined,
          signal: options.signal
        },
        options.profile,
        options.ingestMode
      )

      if (outcome.kind === 'failed') {
        log.warn('Entity failed with scanner issues.', {
          entityPath: entity.path,
          issueTypes: outcome.errors.map((issue) => issue.type).join(', ')
        })
        return { ...createScannedEntity(entity), kind: 'failed', errors: outcome.errors }
      }

      const addResult = outcome.result
      if (!addResult.isNew) {
        log.info('Entry already exists.', {
          entityPath: entity.path,
          existingReason: addResult.existingReason
        })

        if (addResult.existingReason === 'path') {
          return { kind: 'existing', existing: createExisting(entity, addResult.entityId) }
        }

        return {
          ...createScannedEntity(entity),
          kind: 'failed',
          existingEntityId: addResult.entityId,
          errors: [createError('duplicate-external-id', reasons.externalIdLinked)]
        }
      }

      log.info('Successfully added entry.', {
        mediaType: this.mediaType,
        entityId: addResult.entityId,
        entityPath: entity.path
      })

      const warnings = [
        ...(outcome.warnings ?? []),
        ...createIngestWarnings(addResult.warnings),
        ...(await this.finalizeEntity(addResult.entityId, entity, options.signal))
      ]

      return {
        ...createScannedEntity(entity),
        kind: 'new',
        entityId: addResult.entityId,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.error('Error processing entity.', { entityPath: entity.path, message })

      return {
        ...createScannedEntity(entity),
        kind: 'failed',
        errors: [createError('unexpected-error', message)]
      }
    }
  }

  private async checkScannableDirectory(entity: EntityEntry): Promise<ScannerEntityError | null> {
    const reasons = this.i18nService.messages.scanner.run.reasons

    try {
      const stat = await fs.stat(entity.path)
      if (stat.isDirectory()) return null

      log.info('Entity is not a directory.', { entityPath: entity.path })
      return createError('unsupported-entry', reasons.notScannableDirectory)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.warn('Entity path is inaccessible.', { entityPath: entity.path, message })
      return createError('path-unavailable', reasons.pathInaccessible({ message }))
    }
  }

  /** Apply the configured ingest mode to one matched entity. */
  private async addEntity(
    match: ScannerEntityMatch,
    options: ScannerAddOptions,
    profile: ScraperProfile | null,
    ingestMode: ScannerIngestMode
  ): Promise<AddOutcome> {
    const reasons = this.i18nService.messages.scanner.run.reasons

    switch (ingestMode) {
      case 'direct-only':
        return { kind: 'added', result: await this.addDirect(match, options) }

      case 'require-scraper': {
        if (!profile) {
          return {
            kind: 'failed',
            errors: [createError('scraper-unavailable', reasons.scrapeUnavailableRequired)]
          }
        }

        try {
          return {
            kind: 'added',
            result: await this.addFromScraper(profile.id, match, options)
          }
        } catch (error) {
          if (!isRecoverableScraperFailure(error)) throw error

          log.warn('Scraper ingest failed in require-scraper mode.', {
            entityPath: options.entityPath,
            message: error instanceof Error ? error.message : String(error)
          })
          return {
            kind: 'failed',
            errors: [
              createError(
                getScraperProblemType(error),
                isMissingMetadataScraperFailure(error)
                  ? reasons.noMetadataRequired
                  : reasons.scrapeFailedRequired
              )
            ]
          }
        }
      }

      case 'prefer-scraper': {
        if (!profile) {
          return {
            kind: 'added',
            result: await this.addDirect(match, options),
            warnings: [createWarning('scraper-unavailable', reasons.scrapeUnavailableFallback)]
          }
        }

        try {
          return {
            kind: 'added',
            result: await this.addFromScraper(profile.id, match, options)
          }
        } catch (error) {
          if (!isRecoverableScraperFailure(error)) throw error

          log.warn('Scraper ingest failed, falling back to direct ingest.', {
            entityPath: options.entityPath,
            message: error instanceof Error ? error.message : String(error)
          })
          return {
            kind: 'added',
            result: await this.addDirect(match, options),
            warnings: [
              createWarning(
                getScraperProblemType(error),
                isMissingMetadataScraperFailure(error)
                  ? reasons.noMetadataFallback
                  : reasons.scrapeFailedFallback
              )
            ]
          }
        }
      }

      default:
        return assertNever(ingestMode)
    }
  }

  // ---------------------------------------------------------------------------
  // Scanner records
  // ---------------------------------------------------------------------------

  private loadScanner(scannerId: string): Scanner {
    const scanner = this.getScannerById(scannerId)
    if (!scanner) {
      throw new Error(`Scanner not found: ${scannerId}`)
    }

    if (scanner.type !== this.mediaType) {
      throw new Error(`Scanner ${scanner.name} is not a ${this.mediaType} scanner`)
    }

    return scanner
  }

  private listMediaScanners(): Scanner[] {
    try {
      return this.dbService.client
        .select()
        .from(scanners)
        .where(eq(scanners.type, this.mediaType))
        .all()
    } catch (error) {
      log.error('Failed to list scanners.', { mediaType: this.mediaType, error })
      return []
    }
  }

  private getScannerById(scannerId: string): Scanner | null {
    try {
      const [scanner] = this.dbService.client
        .select()
        .from(scanners)
        .where(eq(scanners.id, scannerId))
        .limit(1)
        .all()
      return scanner ?? null
    } catch (error) {
      log.error('Failed to get scanner.', { scannerId, error })
      return null
    }
  }

  private getScraperProfile(profileId: string): ScraperProfile | null {
    try {
      const [profile] = this.dbService.client
        .select()
        .from(scraperProfiles)
        .where(eq(scraperProfiles.id, profileId))
        .limit(1)
        .all()
      return profile ?? null
    } catch (error) {
      log.error('Failed to get profile.', { profileId, error })
      return null
    }
  }
}
