/**
 * Comic Scanner Handler
 *
 * Adds the comic-specific parts of a scan: resolving a directory to an
 * existing entry, handing the match to ingest, and reconciling the unit files
 * inside the directory once the entry exists.
 */

import { createLogger } from '@main/log'
import type { IngestService } from '@main/services/ingest'
import type { MediaFilesService } from '@main/services/media-files'
import type { EntityEntry } from '@shared/scanner'
import type { ScannerEntityWarning } from '../../run'
import { createWarning } from '../issues'
import {
  MediaScannerHandler,
  type MediaScannerHandlerDeps,
  type ScannerAddOptions,
  type ScannerAddOutcome,
  type ScannerEntityMatch
} from '../media-handler'

const log = createLogger('Scanner')

export class ComicScannerHandler extends MediaScannerHandler {
  constructor(
    deps: MediaScannerHandlerDeps,
    private readonly ingestService: IngestService,
    private readonly mediaFilesService: MediaFilesService
  ) {
    super('comic', deps)
  }

  protected findExistingByPath(path: string): { id: string; name: string } | undefined {
    return this.dbService.entityFinder.findExistingComic({ path })
  }

  protected async addDirect(
    match: ScannerEntityMatch,
    options: ScannerAddOptions
  ): Promise<ScannerAddOutcome> {
    const result = await this.ingestService.add.comic.addDirect(
      toSeed(match),
      toAddOptions(options)
    )
    return { ...result, entityId: result.comicId }
  }

  protected async addFromScraper(
    profileId: string,
    match: ScannerEntityMatch,
    options: ScannerAddOptions
  ): Promise<ScannerAddOutcome> {
    const result = await this.ingestService.add.comic.addFromScraper(
      profileId,
      toSeed(match),
      toAddOptions(options)
    )
    return { ...result, entityId: result.comicId }
  }

  /**
   * Attach the directory's readable containers to the new entry.
   *
   * A directory with no readable unit numbers is still added: the entry is
   * valid metadata, and the warning tells the user which files need renaming.
   */
  protected async finalizeEntity(
    entityId: string,
    entity: EntityEntry,
    signal: AbortSignal
  ): Promise<ScannerEntityWarning[]> {
    const reasons = this.i18nService.messages.scanner.run.reasons

    try {
      const sync = await this.mediaFilesService.comic.sync({
        comicId: entityId,
        dirPath: entity.path,
        signal
      })

      if (sync.unrecognizedFiles.length === 0) return []

      return [
        createWarning(
          'metadata-missing',
          reasons.unitNumbersUnreadable({ count: sync.unrecognizedFiles.length })
        )
      ]
    } catch (error) {
      log.warn('Failed to sync comic files after add.', error, { entityPath: entity.path })
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
    comicDirPath: options.entityPath,
    targetCollectionId: options.targetCollectionId,
    signal: options.signal
  }
}
