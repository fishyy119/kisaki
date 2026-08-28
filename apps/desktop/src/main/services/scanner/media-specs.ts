/**
 * Per-media scanner specs.
 *
 * One entry per media type declares how a discovered directory is recognized
 * as an existing entry, how a match reaches ingest, and how holdings attach
 * unit files after the entry exists. The media-neutral pipeline in `scan.ts`
 * consumes the registry; adding a media type is one entry here.
 */

import type { DbService } from '@main/services/db'
import type { HoldingsService } from '@main/services/holdings'
import type { IngestService } from '@main/services/ingest'
import type { MediaType } from '@shared/common'
import type { ExternalId } from '@shared/identity'
import type { ExistingReason, IngestWarning } from '@shared/ingest/common'
import type { Messages } from '@shared/i18n'

/** Identity resolved for one discovered directory before it is added. */
export interface ScannerEntityMatch {
  name: string
  externalIds: ExternalId[]
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

/** Services a spec may reach; the pipeline provides one instance to all. */
export interface ScannerMediaDeps {
  dbService: DbService
  ingestService: IngestService
  holdingsService: HoldingsService
}

/** Post-add file reconciliation for media whose entries own unit files. */
export interface ScannerHoldingsSyncSpec {
  run(
    deps: ScannerMediaDeps,
    entityId: string,
    dirPath: string,
    signal: AbortSignal
  ): Promise<{ unrecognizedFiles: string[] }>
  /** Warning text for files whose unit number could not be read. */
  unreadableMessage(messages: Messages, count: number): string
}

export interface ScannerMediaSpec {
  /** Existing entry already claiming this directory, if any. */
  findExistingByPath(deps: ScannerMediaDeps, path: string): { id: string; name: string } | undefined
  addDirect(
    deps: ScannerMediaDeps,
    match: ScannerEntityMatch,
    options: ScannerAddOptions
  ): Promise<ScannerAddOutcome>
  addFromScraper(
    deps: ScannerMediaDeps,
    profileId: string,
    match: ScannerEntityMatch,
    options: ScannerAddOptions
  ): Promise<ScannerAddOutcome>
  /** Absent for media without unit files (game entries only claim a directory). */
  holdingsSync?: ScannerHoldingsSyncSpec
}

function toSeed(match: ScannerEntityMatch): { name: string; knownIds?: ExternalId[] } {
  return {
    name: match.name,
    knownIds: match.externalIds.length > 0 ? match.externalIds : undefined
  }
}

export const SCANNER_MEDIA_SPECS = {
  game: {
    findExistingByPath: (deps, path) => deps.dbService.entityFinder.findExisting('game', { path }),
    addDirect: async (deps, match, options) => {
      const result = await deps.ingestService.add.game.addDirect(toSeed(match), {
        gameDirPath: options.entityPath,
        targetCollectionId: options.targetCollectionId,
        signal: options.signal
      })
      return { ...result, entityId: result.gameId }
    },
    addFromScraper: async (deps, profileId, match, options) => {
      const result = await deps.ingestService.add.game.addFromScraper(profileId, toSeed(match), {
        gameDirPath: options.entityPath,
        targetCollectionId: options.targetCollectionId,
        signal: options.signal
      })
      return { ...result, entityId: result.gameId }
    }
  },
  anime: {
    findExistingByPath: (deps, path) => deps.dbService.entityFinder.findExisting('anime', { path }),
    addDirect: async (deps, match, options) => {
      const result = await deps.ingestService.add.anime.addDirect(toSeed(match), {
        animeDirPath: options.entityPath,
        targetCollectionId: options.targetCollectionId,
        signal: options.signal
      })
      return { ...result, entityId: result.animeId }
    },
    addFromScraper: async (deps, profileId, match, options) => {
      const result = await deps.ingestService.add.anime.addFromScraper(profileId, toSeed(match), {
        animeDirPath: options.entityPath,
        targetCollectionId: options.targetCollectionId,
        signal: options.signal
      })
      return { ...result, entityId: result.animeId }
    },
    holdingsSync: {
      run: (deps, entityId, dirPath, signal) =>
        deps.holdingsService.anime.sync({ animeId: entityId, dirPath, signal }),
      unreadableMessage: (messages, count) =>
        messages.scanner.run.reasons.episodeNumbersUnreadable({ count })
    }
  },
  comic: {
    findExistingByPath: (deps, path) => deps.dbService.entityFinder.findExisting('comic', { path }),
    addDirect: async (deps, match, options) => {
      const result = await deps.ingestService.add.comic.addDirect(toSeed(match), {
        comicDirPath: options.entityPath,
        targetCollectionId: options.targetCollectionId,
        signal: options.signal
      })
      return { ...result, entityId: result.comicId }
    },
    addFromScraper: async (deps, profileId, match, options) => {
      const result = await deps.ingestService.add.comic.addFromScraper(profileId, toSeed(match), {
        comicDirPath: options.entityPath,
        targetCollectionId: options.targetCollectionId,
        signal: options.signal
      })
      return { ...result, entityId: result.comicId }
    },
    holdingsSync: {
      run: (deps, entityId, dirPath, signal) =>
        deps.holdingsService.comic.sync({ comicId: entityId, dirPath, signal }),
      unreadableMessage: (messages, count) =>
        messages.scanner.run.reasons.unitNumbersUnreadable({ count })
    }
  },
  novel: {
    findExistingByPath: (deps, path) => deps.dbService.entityFinder.findExisting('novel', { path }),
    addDirect: async (deps, match, options) => {
      const result = await deps.ingestService.add.novel.addDirect(toSeed(match), {
        novelDirPath: options.entityPath,
        targetCollectionId: options.targetCollectionId,
        signal: options.signal
      })
      return { ...result, entityId: result.novelId }
    },
    addFromScraper: async (deps, profileId, match, options) => {
      const result = await deps.ingestService.add.novel.addFromScraper(profileId, toSeed(match), {
        novelDirPath: options.entityPath,
        targetCollectionId: options.targetCollectionId,
        signal: options.signal
      })
      return { ...result, entityId: result.novelId }
    },
    holdingsSync: {
      run: (deps, entityId, dirPath, signal) =>
        deps.holdingsService.novel.sync({ novelId: entityId, dirPath, signal }),
      unreadableMessage: (messages, count) =>
        messages.scanner.run.reasons.volumeNumbersUnreadable({ count })
    }
  }
} as const satisfies Record<MediaType, ScannerMediaSpec>
