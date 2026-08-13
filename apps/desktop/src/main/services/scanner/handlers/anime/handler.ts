/**
 * Anime Scanner Handler
 *
 * Adds the anime-specific parts of a scan: resolving a directory to an existing
 * entry, handing the match to ingest, and reconciling the episode files inside
 * the directory once the entry exists.
 */

import { createLogger } from '@main/log'
import type { IngestService } from '@main/services/ingest'
import type { EntityEntry } from '@shared/scanner'
import {
  createWarning,
  MediaScannerHandler,
  type MediaScannerHandlerDeps,
  type ScannerAddOptions,
  type ScannerAddOutcome,
  type ScannerEntityMatch,
  type ScannerEntityWarning
} from '../common'

const log = createLogger('Scanner')

export class AnimeScannerHandler extends MediaScannerHandler {
  constructor(
    deps: MediaScannerHandlerDeps,
    private readonly ingestService: IngestService
  ) {
    super('anime', deps)
  }

  protected findExistingByPath(path: string): { id: string; name: string } | undefined {
    return this.dbService.entityFinder.findExistingAnime({ path })
  }

  protected async addDirect(
    match: ScannerEntityMatch,
    options: ScannerAddOptions
  ): Promise<ScannerAddOutcome> {
    const result = await this.ingestService.add.anime.addDirect(
      toSeed(match),
      toAddOptions(options)
    )
    return { ...result, entityId: result.animeId }
  }

  protected async addFromScraper(
    profileId: string,
    match: ScannerEntityMatch,
    options: ScannerAddOptions
  ): Promise<ScannerAddOutcome> {
    const result = await this.ingestService.add.anime.addFromScraper(
      profileId,
      toSeed(match),
      toAddOptions(options)
    )
    return { ...result, entityId: result.animeId }
  }

  /**
   * Attach the directory's video files to the new entry.
   *
   * A directory with no readable episode numbers is still added: the entry is
   * valid metadata, and the warning tells the user which files need renaming.
   */
  protected async finalizeEntity(
    entityId: string,
    entity: EntityEntry,
    signal: AbortSignal
  ): Promise<ScannerEntityWarning[]> {
    const reasons = this.i18nService.messages.scanner.run.reasons

    try {
      const sync = await this.ingestService.files.anime.sync({
        animeId: entityId,
        dirPath: entity.path,
        signal
      })

      if (sync.unrecognizedFiles.length === 0) return []

      return [
        createWarning(
          'metadata-missing',
          reasons.episodeNumbersUnreadable({ count: sync.unrecognizedFiles.length })
        )
      ]
    } catch (error) {
      log.warn('Failed to sync anime files after add.', error, { entityPath: entity.path })
      return [createWarning('file-sync-failed', reasons.episodeSyncFailed)]
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
    animeDirPath: options.entityPath,
    targetCollectionId: options.targetCollectionId,
    signal: options.signal
  }
}
