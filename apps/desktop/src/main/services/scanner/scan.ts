/**
 * Media-neutral scan pipeline.
 *
 * Owns everything a scan does regardless of media type: directory discovery,
 * per-entity guards, ingest-mode policy, and issue construction. What a media
 * type contributes — lookup, ingest calls, unit-file sync — is declared in
 * `media-specs.ts` and resolved by the scanner's stored type.
 */

import { promises as fs } from 'node:fs'
import { eq } from 'drizzle-orm'

import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { HoldingsService } from '@main/services/holdings'
import type { I18nService } from '@main/services/i18n'
import type { IngestService } from '@main/services/ingest'
import { isCancellation } from '@main/services/task-run'
import type { Semaphore } from '@main/utils/async'
import {
  scraperProfiles,
  type Scanner,
  type ScannerIngestMode,
  type ScraperProfile
} from '@shared/db'
import type { EntityEntry } from '@shared/scanner'
import { assertNever } from '@shared/utils/exhaustive'
import type { ScannerDiscovery } from './discovery'
import type { ScannerHooks } from './hooks'
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
import {
  SCANNER_MEDIA_SPECS,
  type ScannerAddOutcome,
  type ScannerEntityMatch,
  type ScannerMediaDeps,
  type ScannerMediaSpec
} from './media-specs'
import type {
  ScannerEntityError,
  ScannerEntityProcessResult,
  ScannerEntityWarning,
  ScannerRunSession
} from './run'

const log = createLogger('Scanner')

export interface ScanExecutorDeps {
  discovery: ScannerDiscovery
  dbService: DbService
  ingestService: IngestService
  holdingsService: HoldingsService
  hooks: ScannerHooks
  i18nService: I18nService
}

type AddOutcome =
  | { kind: 'added'; result: ScannerAddOutcome; warnings?: ScannerEntityWarning[] }
  | { kind: 'failed'; errors: ScannerEntityError[] }

interface ProcessEntityOptions {
  scanner: Scanner
  spec: ScannerMediaSpec
  profile: ScraperProfile | null
  ingestMode: ScannerIngestMode
  signal: AbortSignal
}

export class ScanExecutor {
  private readonly mediaDeps: ScannerMediaDeps

  constructor(
    private readonly deps: ScanExecutorDeps,
    /** Application-wide entity budget; read per run so setting changes apply. */
    private readonly getLimiter: () => Semaphore
  ) {
    this.mediaDeps = {
      dbService: deps.dbService,
      ingestService: deps.ingestService,
      holdingsService: deps.holdingsService
    }
  }

  async runScan(scanner: Scanner, session: ScannerRunSession): Promise<void> {
    const { scannerIgnoredNames: ignoredNames, scannerIngestMode: ingestMode } =
      this.deps.dbService.settings.get()
    const spec = SCANNER_MEDIA_SPECS[scanner.type]
    const messages = this.deps.i18nService.messages

    const profile = this.getScraperProfile(scanner.scraperProfileId)
    if (!profile && ingestMode !== 'direct-only') {
      log.warn('Scanner has no scraper profile.', {
        scannerName: scanner.name,
        ingestMode
      })
    }

    log.info('Starting scan.', {
      mediaType: scanner.type,
      scannerName: scanner.name,
      scannerPath: scanner.path,
      scannerEntityDepth: scanner.entityDepth,
      ingestMode,
      profileName: profile?.name ?? 'none'
    })

    session.reportPhase('discovering', messages.scanner.run.discovering, true)
    await session.checkpoint()

    const discoveredEntries = await this.deps.discovery.scanForEntities(scanner.path, {
      entityDepth: scanner.entityDepth,
      ignoredNames,
      nameExtractionRules: scanner.nameExtractionRules
    })

    const entities: EntityEntry[] = []
    for (const entry of discoveredEntries) {
      const discovered = await this.deps.hooks.entryDiscovered.transform({
        mediaType: scanner.type,
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

    session.reportPhase('processing', messages.scanner.run.processing)
    session.setTotal(entities.length)
    await session.processItems(entities, this.getLimiter(), async (entity) => {
      session.recordEntityResult(
        await this.processEntity(entity, {
          scanner,
          spec,
          profile,
          ingestMode,
          signal: session.signal
        })
      )
    })

    log.info('Scan completed.', {
      mediaType: scanner.type,
      newCount: session.state.newCount,
      existingCount: session.state.existingCount,
      failedCount: session.state.failedCount,
      issueCount: session.state.issueCount
    })
  }

  private async processEntity(
    entity: EntityEntry,
    options: ProcessEntityOptions
  ): Promise<ScannerEntityProcessResult> {
    const reasons = this.deps.i18nService.messages.scanner.run.reasons
    const { scanner, spec } = options

    try {
      const directoryError = await this.checkScannableDirectory(entity)
      if (directoryError) {
        return { ...createScannedEntity(entity), kind: 'failed', errors: [directoryError] }
      }

      const existingByPath = spec.findExistingByPath(this.mediaDeps, entity.path)
      if (existingByPath) {
        log.info('Entry already exists at path.', {
          entityPath: entity.path,
          existingName: existingByPath.name
        })
        return { kind: 'existing', existing: createExisting(entity, existingByPath.id) }
      }

      // The built-in baseline is the extracted folder name; hook subscribers
      // (such as the built-in pHash match extension) may upgrade the match.
      const matched = await this.deps.hooks.entryMatched.transform({
        mediaType: scanner.type,
        entry: entity,
        name: entity.extractedName,
        externalIds: [],
        matchSource: 'folder-name'
      })
      const outcome = await this.addEntity(
        spec,
        { name: matched.name, externalIds: matched.externalIds },
        options,
        entity
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
        mediaType: scanner.type,
        entityId: addResult.entityId,
        entityPath: entity.path
      })

      const warnings = [
        ...(outcome.warnings ?? []),
        ...createIngestWarnings(addResult.warnings),
        ...(await this.finalizeEntity(spec, addResult.entityId, entity, options.signal))
      ]

      return {
        ...createScannedEntity(entity),
        kind: 'new',
        entityId: addResult.entityId,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    } catch (error) {
      // A cancelled entity is not a failed entity: the run-level cancellation
      // path owns the outcome, so the abort propagates instead of polluting
      // the result with fabricated issues.
      if (isCancellation(error) || options.signal.aborted) {
        throw error
      }

      log.error('Error processing entity.', error, { entityPath: entity.path })
      return {
        ...createScannedEntity(entity),
        kind: 'failed',
        errors: [createError('unexpected-error', reasons.unexpected)]
      }
    }
  }

  private async checkScannableDirectory(entity: EntityEntry): Promise<ScannerEntityError | null> {
    const reasons = this.deps.i18nService.messages.scanner.run.reasons

    try {
      const stat = await fs.stat(entity.path)
      if (stat.isDirectory()) return null

      log.info('Entity is not a directory.', { entityPath: entity.path })
      return createError('unsupported-entry', reasons.notScannableDirectory)
    } catch (error) {
      // The raw filesystem error stays in the log; the issue row gets our wording.
      log.warn('Entity path is inaccessible.', error, { entityPath: entity.path })
      return createError('path-unavailable', reasons.pathInaccessible)
    }
  }

  /** Apply the configured ingest mode to one matched entity. */
  private async addEntity(
    spec: ScannerMediaSpec,
    match: ScannerEntityMatch,
    options: ProcessEntityOptions,
    entity: EntityEntry
  ): Promise<AddOutcome> {
    const reasons = this.deps.i18nService.messages.scanner.run.reasons
    const addOptions = {
      entityPath: entity.path,
      targetCollectionId: options.scanner.targetCollectionId || undefined,
      signal: options.signal
    }
    const { profile, ingestMode } = options

    switch (ingestMode) {
      case 'direct-only':
        return { kind: 'added', result: await spec.addDirect(this.mediaDeps, match, addOptions) }

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
            result: await spec.addFromScraper(this.mediaDeps, profile.id, match, addOptions)
          }
        } catch (error) {
          if (!isRecoverableScraperFailure(error)) throw error

          log.warn('Scraper ingest failed in require-scraper mode.', {
            entityPath: entity.path,
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
            result: await spec.addDirect(this.mediaDeps, match, addOptions),
            warnings: [createWarning('scraper-unavailable', reasons.scrapeUnavailableFallback)]
          }
        }

        try {
          return {
            kind: 'added',
            result: await spec.addFromScraper(this.mediaDeps, profile.id, match, addOptions)
          }
        } catch (error) {
          if (!isRecoverableScraperFailure(error)) throw error

          log.warn('Scraper ingest failed, falling back to direct ingest.', {
            entityPath: entity.path,
            message: error instanceof Error ? error.message : String(error)
          })
          return {
            kind: 'added',
            result: await spec.addDirect(this.mediaDeps, match, addOptions),
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
        return assertNever(ingestMode, 'scanner ingest mode')
    }
  }

  /**
   * Attach the directory's unit files to the new entry, per the media spec.
   *
   * A directory with no readable unit numbers is still added: the entry is
   * valid metadata, and the warning tells the user which files need renaming.
   */
  private async finalizeEntity(
    spec: ScannerMediaSpec,
    entityId: string,
    entity: EntityEntry,
    signal: AbortSignal
  ): Promise<ScannerEntityWarning[]> {
    const sync = spec.holdingsSync
    if (!sync) return []

    const messages = this.deps.i18nService.messages

    try {
      const result = await sync.run(this.mediaDeps, entityId, entity.path, signal)
      if (result.unrecognizedFiles.length === 0) return []

      return [
        createWarning(
          'metadata-missing',
          sync.unreadableMessage(messages, result.unrecognizedFiles.length)
        )
      ]
    } catch (error) {
      if (isCancellation(error) || signal.aborted) throw error

      log.warn('Failed to sync entity files after add.', error, { entityPath: entity.path })
      return [createWarning('file-sync-failed', messages.scanner.run.reasons.fileSyncFailed)]
    }
  }

  private getScraperProfile(profileId: string | null): ScraperProfile | null {
    if (!profileId) return null

    try {
      const [profile] = this.deps.dbService.client
        .select()
        .from(scraperProfiles)
        .where(eq(scraperProfiles.id, profileId))
        .limit(1)
        .all()
      return profile ?? null
    } catch (error) {
      log.error('Failed to get profile.', error, { profileId })
      return null
    }
  }
}
