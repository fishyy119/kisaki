/**
 * Per-entity ingest add specs.
 *
 * One entry per content entity declares the facts the add engine consumes:
 * scrape channel, graph builders, persist call, existing-entry lookup, and
 * result projection. The flow itself lives once in `engine.ts`; adding an
 * entity type is one entry here.
 */

import type { DbService } from '@main/services/db'
import type { ScraperService } from '@main/services/scraper'
import type { ContentEntityType } from '@shared/common'
import type { ExternalId } from '@shared/identity'
import type { ExistingReason, IngestAddResult } from '@shared/ingest'
import type {
  IngestAddAnimeDirectSeed,
  IngestAddAnimeFromScraperOptions,
  IngestAddAnimeResult,
  IngestAddCharacterFromScraperOptions,
  IngestAddCharacterResult,
  IngestAddComicDirectSeed,
  IngestAddComicFromScraperOptions,
  IngestAddComicResult,
  IngestAddCompanyFromScraperOptions,
  IngestAddCompanyResult,
  IngestAddGameDirectSeed,
  IngestAddGameFromScraperOptions,
  IngestAddGameResult,
  IngestAddNovelDirectSeed,
  IngestAddNovelFromScraperOptions,
  IngestAddNovelResult,
  IngestAddPersonFromScraperOptions,
  IngestAddPersonResult
} from '@shared/ingest/add'
import type {
  AnimeScraperLookup,
  ComicScraperLookup,
  GameScraperLookup,
  NovelScraperLookup,
  ScrapedAnimeBundle,
  ScrapedCharacterBundle,
  ScrapedComicBundle,
  ScrapedCompanyBundle,
  ScrapedGameBundle,
  ScrapedIdentityCarrier,
  ScrapedNovelBundle,
  ScrapedPersonBundle,
  ScraperLookup
} from '@shared/scraper'
import {
  buildAnimeGraph,
  buildCharacterGraph,
  buildComicGraph,
  buildCompanyGraph,
  buildDirectAnimeGraph,
  buildDirectComicGraph,
  buildDirectGameGraph,
  buildDirectNovelGraph,
  buildGameGraph,
  buildNovelGraph,
  buildPersonGraph
} from '../graph'
import type {
  IngestAnimeGraph,
  IngestCharacterGraph,
  IngestComicGraph,
  IngestCompanyGraph,
  IngestGameGraph,
  IngestNovelGraph,
  IngestPersonGraph
} from '../graph'
import type { IngestPersistHandlers } from '../persist'
import type { IngestOperationOptions } from '../types'

/**
 * Per-entity type correlation for the add flow.
 *
 * Satellite entities have no direct add, stated as `seed: never`, which makes
 * the direct facade methods uncallable for them.
 */
export interface IngestAddTypeMap {
  game: {
    lookup: GameScraperLookup
    bundle: ScrapedGameBundle
    graph: IngestGameGraph
    seed: IngestAddGameDirectSeed
    options: IngestAddGameFromScraperOptions
    result: IngestAddGameResult
  }
  anime: {
    lookup: AnimeScraperLookup
    bundle: ScrapedAnimeBundle
    graph: IngestAnimeGraph
    seed: IngestAddAnimeDirectSeed
    options: IngestAddAnimeFromScraperOptions
    result: IngestAddAnimeResult
  }
  comic: {
    lookup: ComicScraperLookup
    bundle: ScrapedComicBundle
    graph: IngestComicGraph
    seed: IngestAddComicDirectSeed
    options: IngestAddComicFromScraperOptions
    result: IngestAddComicResult
  }
  novel: {
    lookup: NovelScraperLookup
    bundle: ScrapedNovelBundle
    graph: IngestNovelGraph
    seed: IngestAddNovelDirectSeed
    options: IngestAddNovelFromScraperOptions
    result: IngestAddNovelResult
  }
  person: {
    lookup: ScraperLookup
    bundle: ScrapedPersonBundle
    graph: IngestPersonGraph
    seed: never
    options: IngestAddPersonFromScraperOptions
    result: IngestAddPersonResult
  }
  company: {
    lookup: ScraperLookup
    bundle: ScrapedCompanyBundle
    graph: IngestCompanyGraph
    seed: never
    options: IngestAddCompanyFromScraperOptions
    result: IngestAddCompanyResult
  }
  character: {
    lookup: ScraperLookup
    bundle: ScrapedCharacterBundle
    graph: IngestCharacterGraph
    seed: never
    options: IngestAddCharacterFromScraperOptions
    result: IngestAddCharacterResult
  }
}

// Correlated aliases carry the base shapes the engine reads (name, identity,
// collection target, result flags), so the flow needs no per-entity accessors
// and no assertions.
export type IngestAddLookup<T extends ContentEntityType> = IngestAddTypeMap[T]['lookup'] &
  ScraperLookup
export type IngestAddBundle<T extends ContentEntityType> = IngestAddTypeMap[T]['bundle'] &
  ScrapedIdentityCarrier
export type IngestAddGraph<T extends ContentEntityType> = IngestAddTypeMap[T]['graph']
export type IngestAddSeed<T extends ContentEntityType> = IngestAddTypeMap[T]['seed'] & {
  name: string
  knownIds?: ExternalId[]
}
export type IngestAddOptions<T extends ContentEntityType> = IngestAddTypeMap[T]['options'] & {
  targetCollectionId?: string
}
export type IngestAddResultOf<T extends ContentEntityType> = IngestAddTypeMap[T]['result'] &
  IngestAddResult

/** Services a spec may reach; the engine provides one instance to all. */
export interface IngestAddDeps {
  dbService: DbService
  scraperService: ScraperService
  persist: IngestPersistHandlers
}

export interface IngestAddSpec<T extends ContentEntityType> {
  scrape(
    deps: IngestAddDeps,
    profileId: string,
    lookup: IngestAddLookup<T>,
    signal: AbortSignal | undefined
  ): Promise<IngestAddBundle<T> | null>
  buildGraph(bundle: IngestAddBundle<T>, lookup: IngestAddLookup<T>): IngestAddGraph<T>
  /** Present only for media types; direct add persists seed facts unscraped. */
  buildDirectGraph?(seed: { name: string; knownIds?: ExternalId[] }): IngestAddGraph<T>
  persist(
    deps: IngestAddDeps,
    graph: IngestAddGraph<T>,
    options: (IngestAddOptions<T> & IngestOperationOptions) | undefined
  ): Promise<IngestAddResultOf<T>>
  readEntityId(result: IngestAddResultOf<T>): string
  toExistingResult(entityId: string, reason: ExistingReason): IngestAddResultOf<T>
  findExisting(
    deps: IngestAddDeps,
    params: { path?: string; externalIds?: ExternalId[] }
  ): { id: string } | undefined
  /** Directory identity inside the options; absent for entities that claim none. */
  dirPathOf?(options: IngestAddOptions<T> | undefined): string | undefined
}

export const INGEST_ADD_SPECS = {
  game: {
    scrape: (deps, profileId, lookup, signal) =>
      deps.scraperService.game.scrape(profileId, lookup, { signal }),
    buildGraph: buildGameGraph,
    buildDirectGraph: buildDirectGameGraph,
    persist: (deps, graph, options) => deps.persist.game.persistGameGraph(graph, options),
    readEntityId: (result) => result.gameId,
    toExistingResult: (gameId, existingReason) => ({ gameId, isNew: false, existingReason }),
    findExisting: (deps, params) => deps.dbService.entityFinder.findExisting('game', params),
    dirPathOf: (options) => options?.gameDirPath
  },
  anime: {
    scrape: (deps, profileId, lookup, signal) =>
      deps.scraperService.anime.scrape(profileId, lookup, { signal }),
    buildGraph: buildAnimeGraph,
    buildDirectGraph: buildDirectAnimeGraph,
    persist: (deps, graph, options) => deps.persist.anime.persistAnimeGraph(graph, options),
    readEntityId: (result) => result.animeId,
    toExistingResult: (animeId, existingReason) => ({ animeId, isNew: false, existingReason }),
    findExisting: (deps, params) => deps.dbService.entityFinder.findExisting('anime', params),
    dirPathOf: (options) => options?.animeDirPath
  },
  comic: {
    scrape: (deps, profileId, lookup, signal) =>
      deps.scraperService.comic.scrape(profileId, lookup, { signal }),
    buildGraph: buildComicGraph,
    buildDirectGraph: buildDirectComicGraph,
    persist: (deps, graph, options) => deps.persist.comic.persistComicGraph(graph, options),
    readEntityId: (result) => result.comicId,
    toExistingResult: (comicId, existingReason) => ({ comicId, isNew: false, existingReason }),
    findExisting: (deps, params) => deps.dbService.entityFinder.findExisting('comic', params),
    dirPathOf: (options) => options?.comicDirPath
  },
  novel: {
    scrape: (deps, profileId, lookup, signal) =>
      deps.scraperService.novel.scrape(profileId, lookup, { signal }),
    buildGraph: buildNovelGraph,
    buildDirectGraph: buildDirectNovelGraph,
    persist: (deps, graph, options) => deps.persist.novel.persistNovelGraph(graph, options),
    readEntityId: (result) => result.novelId,
    toExistingResult: (novelId, existingReason) => ({ novelId, isNew: false, existingReason }),
    findExisting: (deps, params) => deps.dbService.entityFinder.findExisting('novel', params),
    dirPathOf: (options) => options?.novelDirPath
  },
  person: {
    scrape: (deps, profileId, lookup, signal) =>
      deps.scraperService.person.scrape(profileId, lookup, { signal }),
    buildGraph: buildPersonGraph,
    persist: (deps, graph, options) => deps.persist.person.persistPersonGraph(graph, options),
    readEntityId: (result) => result.personId,
    toExistingResult: (personId, existingReason) => ({ personId, isNew: false, existingReason }),
    findExisting: (deps, params) => deps.dbService.entityFinder.findExisting('person', params)
  },
  company: {
    scrape: (deps, profileId, lookup, signal) =>
      deps.scraperService.company.scrape(profileId, lookup, { signal }),
    buildGraph: buildCompanyGraph,
    persist: (deps, graph, options) => deps.persist.company.persistCompanyGraph(graph, options),
    readEntityId: (result) => result.companyId,
    toExistingResult: (companyId, existingReason) => ({ companyId, isNew: false, existingReason }),
    findExisting: (deps, params) => deps.dbService.entityFinder.findExisting('company', params)
  },
  character: {
    scrape: (deps, profileId, lookup, signal) =>
      deps.scraperService.character.scrape(profileId, lookup, { signal }),
    buildGraph: buildCharacterGraph,
    persist: (deps, graph, options) => deps.persist.character.persistCharacterGraph(graph, options),
    readEntityId: (result) => result.characterId,
    toExistingResult: (characterId, existingReason) => ({
      characterId,
      isNew: false,
      existingReason
    }),
    findExisting: (deps, params) => deps.dbService.entityFinder.findExisting('character', params)
  }
} as const satisfies { [T in ContentEntityType]: IngestAddSpec<T> }
