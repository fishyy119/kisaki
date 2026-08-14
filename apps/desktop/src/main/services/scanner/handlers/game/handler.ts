/**
 * Game Scanner Handler
 *
 * Adds the game-specific parts of a scan: how a directory resolves to an
 * existing game and how a matched directory reaches ingest. Run control,
 * scheduling, discovery, and ingest-mode policy live in the shared base.
 */

import type { IngestService } from '@main/services/ingest'
import {
  MediaScannerHandler,
  type MediaScannerHandlerDeps,
  type ScannerAddOptions,
  type ScannerAddOutcome,
  type ScannerEntityMatch
} from '../common'

export class GameScannerHandler extends MediaScannerHandler {
  constructor(
    deps: MediaScannerHandlerDeps,
    private readonly ingestService: IngestService
  ) {
    super('game', deps)
  }

  protected findExistingByPath(path: string): { id: string; name: string } | undefined {
    return this.dbService.entityFinder.findExistingGame({ path })
  }

  protected async addDirect(
    match: ScannerEntityMatch,
    options: ScannerAddOptions
  ): Promise<ScannerAddOutcome> {
    const result = await this.ingestService.add.game.addDirect(toSeed(match), toAddOptions(options))
    return { ...result, entityId: result.gameId }
  }

  protected async addFromScraper(
    profileId: string,
    match: ScannerEntityMatch,
    options: ScannerAddOptions
  ): Promise<ScannerAddOutcome> {
    const result = await this.ingestService.add.game.addFromScraper(
      profileId,
      toSeed(match),
      toAddOptions(options)
    )
    return { ...result, entityId: result.gameId }
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
    gameDirPath: options.entityPath,
    targetCollectionId: options.targetCollectionId,
    signal: options.signal
  }
}
