/**
 * Movie Scanner Handler
 *
 * Adds the movie-specific parts of a scan: resolving a directory to an existing
 * film, handing the match to ingest, and reconciling the release files inside
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

export class MovieScannerHandler extends MediaScannerHandler {
  constructor(
    deps: MediaScannerHandlerDeps,
    private readonly ingestService: IngestService
  ) {
    super('movie', deps)
  }

  protected findExistingByPath(path: string): { id: string; name: string } | undefined {
    return this.dbService.entityFinder.findExistingMovie({ path })
  }

  protected async addDirect(
    match: ScannerEntityMatch,
    options: ScannerAddOptions
  ): Promise<ScannerAddOutcome> {
    const result = await this.ingestService.add.movie.addDirect(
      toSeed(match),
      toAddOptions(options)
    )
    return { ...result, entityId: result.movieId }
  }

  protected async addFromScraper(
    profileId: string,
    match: ScannerEntityMatch,
    options: ScannerAddOptions
  ): Promise<ScannerAddOutcome> {
    const result = await this.ingestService.add.movie.addFromScraper(
      profileId,
      toSeed(match),
      toAddOptions(options)
    )
    return { ...result, entityId: result.movieId }
  }

  /** Attach the directory's release files and extras to the new entry. */
  protected async finalizeEntity(
    entityId: string,
    entity: EntityEntry,
    signal: AbortSignal
  ): Promise<ScannerEntityWarning[]> {
    const reasons = this.i18nService.messages.scanner.run.reasons

    try {
      await this.ingestService.files.movie.sync({
        movieId: entityId,
        dirPath: entity.path,
        signal
      })
      return []
    } catch (error) {
      log.warn('Failed to sync movie files after add.', error, { entityPath: entity.path })
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
    movieDirPath: options.entityPath,
    targetCollectionId: options.targetCollectionId,
    signal: options.signal
  }
}
