/**
 * Game Scanner Handler
 *
 * Keeps game-specific scan behavior focused on:
 * - loading game scanner/profile context
 * - resolving entities into games
 * - handing add flows to ingest
 *
 * Queueing, run state publishing, controls, and concurrency control
 * are delegated to the shared scanner coordinator in `handlers/common`.
 */

import { createLogger } from '@main/log'
import { promises as fs } from 'node:fs'
import { eq } from 'drizzle-orm'
import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import type { IngestService } from '@main/services/ingest'
import type { IpcService } from '@main/services/ipc'
import type { TaskRunService } from '@main/services/task-run'
import type { TaskRunInitiator } from '@shared/task-run'
import { scanners, scraperProfiles, type ScraperProfile } from '@shared/db'
import type { Scanner, ScannerIngestMode } from '@shared/db'
import type {
  EntityEntry,
  ScanCompletedData,
  ScannerRunExisting,
  ScannerRunState,
  ScannerRunStartResult
} from '@shared/scanner'
import type { IngestAddGameResult } from '@shared/ingest/add'
import type { IngestWarning } from '@shared/ingest/common'
import type { ScannerPhash } from '../../phash'
import type { ScannerDiscovery } from '../../discovery'
import type { ScannerHooks } from '../../hooks'
import {
  ScannerRunCoordinator,
  type ScannedEntity,
  type ScannerEntityError,
  type ScannerEntityErrorType,
  type ScannerEntityProcessResult,
  type ScannerEntityWarning,
  type ScannerEntityWarningType,
  ScannerRunSession
} from '../common'
import { matchGameEntity } from './match'
import type { GameEntity } from './types'

const log = createLogger('Scanner')

type GameEntityProcessOutcome =
  | {
      kind: 'added'
      result: IngestAddGameResult
      warnings?: ScannerEntityWarning[]
    }
  | {
      kind: 'failed'
      errors: ScannerEntityError[]
    }

interface ScannerIssueOptions {
  reason: string
}

function isRecoverableScraperFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  const recoverableMarkers = [
    'profile not found',
    'search provider',
    'provider',
    'scrape',
    'network',
    'timeout',
    'timed out',
    'econn',
    'enotfound',
    'eai_again'
  ]

  return recoverableMarkers.some((marker) => message.includes(marker))
}

function isMissingMetadataScraperFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.message.toLowerCase().includes('returned no game data')
}

function getScraperProblemType(
  error: unknown
): Extract<ScannerEntityWarningType, ScannerEntityErrorType> {
  return isMissingMetadataScraperFailure(error) ? 'metadata-missing' : 'scraper-unavailable'
}

function createScannedEntity(entity: EntityEntry): ScannedEntity {
  return {
    extractedName: entity.extractedName,
    path: entity.path
  }
}

function createWarning(
  type: ScannerEntityWarningType,
  options: ScannerIssueOptions
): ScannerEntityWarning {
  return {
    type,
    reason: options.reason
  }
}

function createError(
  type: ScannerEntityErrorType,
  options: ScannerIssueOptions
): ScannerEntityError {
  return {
    type,
    reason: options.reason
  }
}

function createIngestWarnings(
  warnings: readonly IngestWarning[] | undefined
): ScannerEntityWarning[] {
  return (warnings ?? []).map((warning) =>
    createWarning('asset-persist-failed', {
      reason: warning.message
    })
  )
}

function createExisting(entity: EntityEntry, existingGame: { id: string }): ScannerRunExisting {
  return {
    id: `existing:${entity.path}:${existingGame.id}`,
    extractedName: entity.extractedName,
    path: entity.path,
    gameId: existingGame.id
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported scanner ingest mode: ${String(value)}`)
}

export class GameScannerHandler {
  private readonly scheduledScanners = new Map<string, NodeJS.Timeout>()
  private readonly runs: ScannerRunCoordinator<Scanner>

  constructor(
    private readonly discovery: ScannerDiscovery,
    private readonly phash: ScannerPhash,
    private readonly dbService: DbService,
    ipcService: IpcService,
    private readonly hooks: ScannerHooks,
    private readonly ingestService: IngestService,
    taskRunService: TaskRunService,
    private readonly i18nService: I18nService
  ) {
    this.runs = new ScannerRunCoordinator<Scanner>({
      ipc: ipcService,
      taskRun: taskRunService,
      hooks,
      i18n: i18nService,
      loadScanner: async (scannerId) => this.loadGameScanner(scannerId),
      runScan: async (scanner, session) => this.runScannerScan(scanner, session)
    })
  }

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
    let allScanners: Scanner[] = []
    try {
      allScanners = this.dbService.client
        .select()
        .from(scanners)
        .where(eq(scanners.type, 'game'))
        .all()
    } catch (error) {
      log.error('Failed to get all game scanners.', { error: error })
    }

    const starts: ScannerRunStartResult[] = []
    for (const scanner of allScanners) {
      try {
        starts.push(await this.startScanner(scanner.id, initiator))
      } catch (error) {
        log.error('Failed to start scanner.', {
          scannerName: scanner.name,
          error: error
        })
      }
    }

    return starts
  }

  async scheduleScanner(scannerId: string): Promise<void> {
    this.unscheduleScanner(scannerId)

    const scanner = this.getScannerById(scannerId)
    if (!scanner) {
      log.error('Cannot schedule scanner: not found.', { scannerId: scannerId })
      return
    }

    if (scanner.scanIntervalMinutes <= 0) {
      log.info('Scanner scan interval disabled, not scheduling.', {
        scannerName: scanner.name,
        scannerScanIntervalMinutes: scanner.scanIntervalMinutes
      })
      return
    }

    if (scanner.type !== 'game') {
      log.warn('Scanner is not a game scanner, cannot schedule.', { scannerName: scanner.name })
      return
    }

    const intervalMs = scanner.scanIntervalMinutes * 60 * 1000

    log.info('Scheduling scanner.', {
      scannerName: scanner.name,
      scannerScanIntervalMinutes: scanner.scanIntervalMinutes
    })

    const intervalId = setInterval(async () => {
      log.info('Running scheduled scan for scanner.', { scannerName: scanner.name })
      try {
        await this.runScanner(scannerId, { type: 'system', reason: 'maintenance' })
      } catch (error) {
        log.error('Scheduled scan failed for scanner.', { scannerName: scanner.name, error: error })
      }
    }, intervalMs)

    this.scheduledScanners.set(scannerId, intervalId)
  }

  unscheduleScanner(scannerId: string): void {
    const intervalId = this.scheduledScanners.get(scannerId)
    if (intervalId) {
      clearInterval(intervalId)
      this.scheduledScanners.delete(scannerId)
      log.info('Unscheduled scanner.', { scannerId: scannerId })
    }
  }

  async scheduleAllScanners(): Promise<void> {
    log.info('Scheduling all game scanners with intervals')

    let allScanners: Scanner[] = []
    try {
      allScanners = this.dbService.client
        .select()
        .from(scanners)
        .where(eq(scanners.type, 'game'))
        .all()
    } catch (error) {
      log.error('Failed to get all game scanners.', { error: error })
    }

    for (const scanner of allScanners) {
      await this.scheduleScanner(scanner.id)
    }
  }

  unscheduleAllScanners(): void {
    log.info('Unscheduling all game scanners')

    for (const scannerId of this.scheduledScanners.keys()) {
      this.unscheduleScanner(scannerId)
    }
  }

  getScheduledScannerIds(): string[] {
    return Array.from(this.scheduledScanners.keys())
  }

  isScannerScheduled(scannerId: string): boolean {
    return this.scheduledScanners.has(scannerId)
  }

  cleanup(): void {
    this.unscheduleAllScanners()
    this.runs.cleanup()
  }

  private async runScannerScan(
    scanner: Scanner,
    session: ScannerRunSession<Scanner>
  ): Promise<void> {
    const settingsData = this.dbService.entityFinder.getAppSettings()
    const {
      scannerIgnoredNames: ignoredNames,
      scannerUsePhash,
      scannerParallelCount,
      scannerIngestMode: ingestMode
    } = settingsData

    const profile = this.getScraperProfile(scanner.scraperProfileId)
    if (!profile) {
      log.warn('Scanner has no scraper profile.', {
        scannerName: scanner.name,
        value1:
          ingestMode === 'direct-only'
            ? 'using direct ingest mode'
            : 'using direct ingest fallback mode'
      })
    }

    log.info('Starting game scan.', {
      scannerName: scanner.name,
      scannerPath: scanner.path,
      scannerEntityDepth: scanner.entityDepth,
      ingestMode: ingestMode,
      scannerParallelCount: scannerParallelCount,
      value5: profile?.name ?? 'none'
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
      const discovered = await this.hooks.entryDiscovered.transform({ entry, skip: false })
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
      const entityResult = await this.processEntity(entity, {
        scanner,
        profile,
        ingestMode,
        scannerUsePhash,
        signal: session.signal
      })
      session.recordEntityResult(entityResult)
    })

    log.info('Scan completed.', {
      sessionStateNewCount: session.state.newCount,
      sessionStateExistingCount: session.state.existingCount,
      sessionStateFailedCount: session.state.failedCount,
      sessionStateIssueCount: session.state.issueCount
    })
  }

  private async processGameEntity(
    gameEntity: GameEntity,
    profile: ScraperProfile | null,
    scanner: Scanner,
    ingestMode: ScannerIngestMode,
    signal: AbortSignal
  ): Promise<GameEntityProcessOutcome> {
    const { gameName, externalIds } = gameEntity.matchedGame

    const seed = {
      name: gameName,
      knownIds: externalIds.length > 0 ? externalIds : undefined
    }
    const options = {
      gameDirPath: gameEntity.path,
      targetCollectionId: scanner.targetCollectionId || undefined,
      signal
    }

    const addDirect = async (): Promise<IngestAddGameResult> => {
      return this.ingestService.add.game.addDirect(seed, options)
    }

    switch (ingestMode) {
      case 'direct-only':
        return { kind: 'added', result: await addDirect() }
      case 'require-scraper':
        if (!profile) {
          return {
            kind: 'failed',
            errors: [
              createError('scraper-unavailable', {
                reason: this.i18nService.messages.scanner.run.reasons.scrapeUnavailableRequired
              })
            ]
          }
        }

        try {
          return {
            kind: 'added',
            result: await this.ingestService.add.game.addFromScraper(profile.id, seed, options)
          }
        } catch (error) {
          if (!isRecoverableScraperFailure(error)) {
            throw error
          }

          const message = error instanceof Error ? error.message : String(error)
          const metadataMissing = isMissingMetadataScraperFailure(error)
          log.warn('Scraper ingest failed in require-scraper mode.', {
            gameEntityPath: gameEntity.path,
            message
          })
          return {
            kind: 'failed',
            errors: [
              createError(getScraperProblemType(error), {
                reason: metadataMissing
                  ? this.i18nService.messages.scanner.run.reasons.noMetadataRequired
                  : this.i18nService.messages.scanner.run.reasons.scrapeFailedRequired
              })
            ]
          }
        }
      case 'prefer-scraper':
        if (!profile) {
          const result = await addDirect()
          return {
            kind: 'added',
            result,
            warnings: [
              createWarning('scraper-unavailable', {
                reason: this.i18nService.messages.scanner.run.reasons.scrapeUnavailableFallback
              })
            ]
          }
        }

        try {
          return {
            kind: 'added',
            result: await this.ingestService.add.game.addFromScraper(profile.id, seed, options)
          }
        } catch (error) {
          if (!isRecoverableScraperFailure(error)) {
            throw error
          }

          const message = error instanceof Error ? error.message : String(error)
          const metadataMissing = isMissingMetadataScraperFailure(error)
          log.warn('Scraper ingest failed, falling back to direct ingest.', {
            gameEntityPath: gameEntity.path,
            message: message
          })
          const result = await addDirect()
          return {
            kind: 'added',
            result,
            warnings: [
              createWarning(getScraperProblemType(error), {
                reason: metadataMissing
                  ? this.i18nService.messages.scanner.run.reasons.noMetadataFallback
                  : this.i18nService.messages.scanner.run.reasons.scrapeFailedFallback
              })
            ]
          }
        }
      default:
        return assertNever(ingestMode)
    }
  }

  private logGameEntityProcessOutcome(gameEntity: GameEntity, result: IngestAddGameResult): void {
    if (result.isNew) {
      log.info('Successfully added game.', {
        gameName: gameEntity.matchedGame.gameName,
        resultGameId: result.gameId,
        gameEntityPath: gameEntity.path
      })

      if (result.warnings?.length) {
        log.warn('Game completed with post-commit warnings.', {
          resultGameId: result.gameId,
          resultWarningsItemsText: result.warnings.map((warning) => warning.message).join(' | ')
        })
      }
    }
  }

  private async processEntity(
    entity: EntityEntry,
    options: {
      scanner: Scanner
      profile: ScraperProfile | null
      ingestMode: ScannerIngestMode
      scannerUsePhash: boolean
      signal: AbortSignal
    }
  ): Promise<ScannerEntityProcessResult> {
    try {
      let stat: Awaited<ReturnType<typeof fs.stat>>
      try {
        stat = await fs.stat(entity.path)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log.warn('Entity path is inaccessible.', { entityPath: entity.path, message })
        return {
          ...createScannedEntity(entity),
          kind: 'failed',
          errors: [
            createError('path-unavailable', {
              reason: this.i18nService.messages.scanner.run.reasons.pathInaccessible({ message })
            })
          ]
        }
      }

      if (!stat.isDirectory()) {
        log.info('Entity is not a directory.', { entityPath: entity.path })
        return {
          ...createScannedEntity(entity),
          kind: 'failed',
          errors: [
            createError('unsupported-entry', {
              reason: this.i18nService.messages.scanner.run.reasons.notScannableDirectory
            })
          ]
        }
      }

      const existingByPath = this.dbService.entityFinder.findExistingGame({
        path: entity.path
      })
      if (existingByPath) {
        log.info('Game already exists at path.', {
          entityPath: entity.path,
          existingByPathName: existingByPath.name
        })

        return {
          kind: 'existing',
          existing: createExisting(entity, existingByPath)
        }
      }

      const rawMatch = await matchGameEntity(entity, this.phash, {
        enablePhash: options.scannerUsePhash
      })
      const match = await this.hooks.entryMatched.transform({
        entry: entity,
        name: rawMatch.gameName,
        externalIds: rawMatch.externalIds,
        matchSource: rawMatch.matchSource
      })
      const matchedEntity: GameEntity = {
        ...entity,
        matchedGame: {
          gameName: match.name,
          externalIds: match.externalIds,
          matchSource: rawMatch.matchSource
        }
      }
      const outcome = await this.processGameEntity(
        matchedEntity,
        options.profile,
        options.scanner,
        options.ingestMode,
        options.signal
      )

      if (outcome.kind === 'failed') {
        log.warn('Game entity failed with scanner issues.', {
          entityPath: entity.path,
          issueTypes: outcome.errors.map((issue) => issue.type).join(', '),
          issueReasons: outcome.errors.map((issue) => issue.reason).join(' | ')
        })
        return {
          ...createScannedEntity(entity),
          kind: 'failed',
          errors: outcome.errors
        }
      }

      const addResult = outcome.result
      this.logGameEntityProcessOutcome(matchedEntity, addResult)
      const warnings = [...(outcome.warnings ?? []), ...createIngestWarnings(addResult.warnings)]

      if (addResult.isNew) {
        return {
          ...createScannedEntity(entity),
          kind: 'new',
          gameId: addResult.gameId,
          warnings: warnings.length > 0 ? warnings : undefined
        }
      }

      log.info('Game already exists.', {
        entityPath: entity.path,
        addResultExistingReason: addResult.existingReason
      })

      if (addResult.existingReason === 'path') {
        return {
          kind: 'existing',
          existing: createExisting(entity, { id: addResult.gameId })
        }
      }

      return {
        ...createScannedEntity(entity),
        kind: 'failed',
        existingGameId: addResult.gameId,
        errors: [
          createError('duplicate-external-id', {
            reason: this.i18nService.messages.scanner.run.reasons.externalIdLinked
          })
        ]
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      log.error('Error processing entity.', { entityPath: entity.path, errorMsg: errorMsg })

      return {
        ...createScannedEntity(entity),
        kind: 'failed',
        errors: [
          createError('unexpected-error', {
            reason: errorMsg
          })
        ]
      }
    }
  }

  private loadGameScanner(scannerId: string): Scanner {
    const scanner = this.getScannerById(scannerId)
    if (!scanner) {
      throw new Error(`Scanner not found: ${scannerId}`)
    }

    if (scanner.type !== 'game') {
      throw new Error(`Scanner ${scanner.name} is not a game scanner`)
    }

    return scanner
  }

  private getScannerById(scannerId: string): Scanner | null {
    try {
      const result = this.dbService.client
        .select()
        .from(scanners)
        .where(eq(scanners.id, scannerId))
        .limit(1)
        .all()
      return result[0] || null
    } catch (error) {
      log.error('Failed to get scanner.', { scannerId: scannerId, error: error })
      return null
    }
  }

  private getScraperProfile(profileId: string): ScraperProfile | null {
    try {
      const result = this.dbService.client
        .select()
        .from(scraperProfiles)
        .where(eq(scraperProfiles.id, profileId))
        .limit(1)
        .all()
      return result[0] || null
    } catch (error) {
      log.error('Failed to get profile.', { profileId: profileId, error: error })
      return null
    }
  }
}
