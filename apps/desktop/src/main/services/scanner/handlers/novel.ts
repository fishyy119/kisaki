/**
 * Novel Scanner Handler
 *
 * Adds the novel-specific parts of a scan: resolving a directory to an
 * existing entry, handing the match to ingest, and reconciling the book files
 * inside the directory once the entry exists.
 */

import { createLogger } from '@main/log'
import type { IngestService } from '@main/services/ingest'
import type { HoldingsService } from '@main/services/holdings'
import type { EntityEntry } from '@shared/scanner'
import type { ScannerEntityWarning } from '../run'
import { createWarning } from './issues'
import {
  MediaScannerHandler,
  type MediaScannerHandlerDeps,
  type ScannerAddOptions,
  type ScannerAddOutcome,
  type ScannerEntityMatch
} from './base'

const log = createLogger('Scanner')

export class NovelScannerHandler extends MediaScannerHandler {
  constructor(
    deps: MediaScannerHandlerDeps,
    private readonly ingestService: IngestService,
    private readonly holdingsService: HoldingsService
  ) {
    super('novel', deps)
  }

  protected findExistingByPath(path: string): { id: string; name: string } | undefined {
    return this.dbService.entityFinder.findExistingNovel({ path })
  }

  protected async addDirect(
    match: ScannerEntityMatch,
    options: ScannerAddOptions
  ): Promise<ScannerAddOutcome> {
    const result = await this.ingestService.add.novel.addDirect(
      toSeed(match),
      toAddOptions(options)
    )
    return { ...result, entityId: result.novelId }
  }

  protected async addFromScraper(
    profileId: string,
    match: ScannerEntityMatch,
    options: ScannerAddOptions
  ): Promise<ScannerAddOutcome> {
    const result = await this.ingestService.add.novel.addFromScraper(
      profileId,
      toSeed(match),
      toAddOptions(options)
    )
    return { ...result, entityId: result.novelId }
  }

  /**
   * Attach the directory's book files to the new entry.
   *
   * A directory with no readable volume numbers is still added: the entry is
   * valid metadata, and the warning tells the user which files need renaming.
   */
  protected async finalizeEntity(
    entityId: string,
    entity: EntityEntry,
    signal: AbortSignal
  ): Promise<ScannerEntityWarning[]> {
    const reasons = this.i18nService.messages.scanner.run.reasons

    try {
      const sync = await this.holdingsService.novel.sync({
        novelId: entityId,
        dirPath: entity.path,
        signal
      })

      if (sync.unrecognizedFiles.length === 0) return []

      return [
        createWarning(
          'metadata-missing',
          reasons.volumeNumbersUnreadable({ count: sync.unrecognizedFiles.length })
        )
      ]
    } catch (error) {
      log.warn('Failed to sync novel files after add.', error, { entityPath: entity.path })
      return [createWarning('file-sync-failed', reasons.fileSyncFailed)]
    }
  }
}

function toSeed(match: ScannerEntityMatch) {
  return {
    name: match.name,
    knownIds: match.externalIds.length > 0 ? match.externalIds : undefined
  }
}

function toAddOptions(options: ScannerAddOptions) {
  return {
    novelDirPath: options.entityPath,
    targetCollectionId: options.targetCollectionId,
    signal: options.signal
  }
}
