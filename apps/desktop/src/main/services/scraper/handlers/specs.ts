/**
 * Per-entity scraper handler specs.
 *
 * One entry per content entity declares what the shared handler in
 * `handler.ts` cannot know: the slot vocabulary, the lookup-fact normalizer,
 * and the merge functions. Provider contracts and merge logic stay in each
 * entity's folder; adding an entity type is one entry here plus that folder.
 */

import {
  ANIME_SCRAPER_SLOTS,
  CHARACTER_SCRAPER_SLOTS,
  COMIC_SCRAPER_SLOTS,
  COMPANY_SCRAPER_SLOTS,
  GAME_SCRAPER_SLOTS,
  NOVEL_SCRAPER_SLOTS,
  PERSON_SCRAPER_SLOTS
} from '@shared/db/contracts/constants'
import type { ScraperSlot, SlotStrategy } from '@shared/db/contracts/json'
import type { ScraperProfile } from '@shared/db'
import {
  normalizeAnimeLookupFacts,
  normalizeComicLookupFacts,
  normalizeMediaLookupFacts,
  normalizeNovelLookupFacts,
  type AnimeImageSlot,
  type AnimeScraperLookup,
  type AnimeScraperProviderInfo,
  type AnimeSearchResult,
  type CharacterScraperProviderInfo,
  type CharacterSearchResult,
  type ComicImageSlot,
  type ComicScraperLookup,
  type ComicScraperProviderInfo,
  type ComicSearchResult,
  type CompanyScraperProviderInfo,
  type CompanySearchResult,
  type GameImageSlot,
  type GameScraperLookup,
  type GameScraperProviderInfo,
  type GameSearchResult,
  type NovelImageSlot,
  type NovelScraperLookup,
  type NovelScraperProviderInfo,
  type NovelSearchResult,
  type PersonScraperProviderInfo,
  type PersonSearchResult,
  type ScrapedAnimeBundle,
  type ScrapedCharacterBundle,
  type ScrapedComicBundle,
  type ScrapedCompanyBundle,
  type ScrapedEntityIdentity,
  type ScrapedGameBundle,
  type ScrapedNovelBundle,
  type ScrapedPersonBundle,
  type ScraperLookup,
  type ScraperMediaType
} from '@shared/scraper'
import type {
  BaseScraperSession,
  IdResolvedTarget,
  ScraperProviderContext,
  SlotResult
} from '../types'
import type { RegisteredScraperProvider } from './common/registry'
import { mergeAnimeScraperBundle, mergeAnimeScraperImages } from './anime/merge'
import type { AnimeScraperProvider, AnimeSessionResultMap } from './anime/provider'
import { mergeCharacterScraperBundle, mergeCharacterScraperImages } from './character/merge'
import type { CharacterScraperProvider, CharacterSessionResultMap } from './character/provider'
import { mergeComicScraperBundle, mergeComicScraperImages } from './comic/merge'
import type { ComicScraperProvider, ComicSessionResultMap } from './comic/provider'
import { mergeCompanyScraperBundle, mergeCompanyScraperImages } from './company/merge'
import type { CompanyScraperProvider, CompanySessionResultMap } from './company/provider'
import { mergeGameScraperBundle, mergeGameScraperImages } from './game/merge'
import type { GameScraperProvider, GameSessionResultMap } from './game/provider'
import { mergeNovelScraperBundle, mergeNovelScraperImages } from './novel/merge'
import type { NovelScraperProvider, NovelSessionResultMap } from './novel/provider'
import { mergePersonScraperBundle, mergePersonScraperImages } from './person/merge'
import type { PersonScraperProvider, PersonSessionResultMap } from './person/provider'
import type { CharacterScraperImageSlot } from './character/types'
import type { CompanyScraperImageSlot } from './company/types'
import type { PersonScraperImageSlot } from './person/types'

/**
 * Per-entity type correlation for the scrape pipeline.
 */
export interface ScraperHandlerTypeMap {
  game: {
    slot: GameScraperSlotName
    imageSlot: GameImageSlot
    lookup: GameScraperLookup
    searchResult: GameSearchResult
    bundle: ScrapedGameBundle
    resultMap: GameSessionResultMap
    provider: GameScraperProvider
    providerInfo: GameScraperProviderInfo
  }
  anime: {
    slot: AnimeScraperSlotName
    imageSlot: AnimeImageSlot
    lookup: AnimeScraperLookup
    searchResult: AnimeSearchResult
    bundle: ScrapedAnimeBundle
    resultMap: AnimeSessionResultMap
    provider: AnimeScraperProvider
    providerInfo: AnimeScraperProviderInfo
  }
  comic: {
    slot: ComicScraperSlotName
    imageSlot: ComicImageSlot
    lookup: ComicScraperLookup
    searchResult: ComicSearchResult
    bundle: ScrapedComicBundle
    resultMap: ComicSessionResultMap
    provider: ComicScraperProvider
    providerInfo: ComicScraperProviderInfo
  }
  novel: {
    slot: NovelScraperSlotName
    imageSlot: NovelImageSlot
    lookup: NovelScraperLookup
    searchResult: NovelSearchResult
    bundle: ScrapedNovelBundle
    resultMap: NovelSessionResultMap
    provider: NovelScraperProvider
    providerInfo: NovelScraperProviderInfo
  }
  person: {
    slot: PersonScraperSlotName
    imageSlot: PersonScraperImageSlot
    lookup: ScraperLookup
    searchResult: PersonSearchResult
    bundle: ScrapedPersonBundle
    resultMap: PersonSessionResultMap
    provider: PersonScraperProvider
    providerInfo: PersonScraperProviderInfo
  }
  company: {
    slot: CompanyScraperSlotName
    imageSlot: CompanyScraperImageSlot
    lookup: ScraperLookup
    searchResult: CompanySearchResult
    bundle: ScrapedCompanyBundle
    resultMap: CompanySessionResultMap
    provider: CompanyScraperProvider
    providerInfo: CompanyScraperProviderInfo
  }
  character: {
    slot: CharacterScraperSlotName
    imageSlot: CharacterScraperImageSlot
    lookup: ScraperLookup
    searchResult: CharacterSearchResult
    bundle: ScrapedCharacterBundle
    resultMap: CharacterSessionResultMap
    provider: CharacterScraperProvider
    providerInfo: CharacterScraperProviderInfo
  }
}

type GameScraperSlotName = (typeof GAME_SCRAPER_SLOTS)[number]
type AnimeScraperSlotName = (typeof ANIME_SCRAPER_SLOTS)[number]
type ComicScraperSlotName = (typeof COMIC_SCRAPER_SLOTS)[number]
type NovelScraperSlotName = (typeof NOVEL_SCRAPER_SLOTS)[number]
type PersonScraperSlotName = (typeof PERSON_SCRAPER_SLOTS)[number]
type CompanyScraperSlotName = (typeof COMPANY_SCRAPER_SLOTS)[number]
type CharacterScraperSlotName = (typeof CHARACTER_SCRAPER_SLOTS)[number]

// Correlated aliases carry the base shapes the shared handler reads.
export type ScrapeSlotOf<T extends ScraperMediaType> = ScraperHandlerTypeMap[T]['slot'] &
  ScraperSlot
export type ScrapeImageSlotOf<T extends ScraperMediaType> = ScraperHandlerTypeMap[T]['imageSlot'] &
  ScrapeSlotOf<T>
export type ScrapeLookupOf<T extends ScraperMediaType> = ScraperHandlerTypeMap[T]['lookup'] &
  ScraperLookup
export type ScrapeSearchResultOf<T extends ScraperMediaType> =
  ScraperHandlerTypeMap[T]['searchResult'] & { id: string }
export type ScrapeBundleOf<T extends ScraperMediaType> = ScraperHandlerTypeMap[T]['bundle']
export type ScrapeResultMapOf<T extends ScraperMediaType> = ScraperHandlerTypeMap[T]['resultMap'] &
  Partial<Record<ScrapeSlotOf<T>, unknown>>
export type ScrapeSessionOf<T extends ScraperMediaType> = BaseScraperSession<
  ScrapeSlotOf<T>,
  ScrapeResultMapOf<T>
>
export type ScrapeProviderInfoOf<T extends ScraperMediaType> =
  ScraperHandlerTypeMap[T]['providerInfo']
/** The info slot's payload; every entity's info names the entry (see conventions). */
export type ScrapeInfoOf<T extends ScraperMediaType> = ScraperHandlerTypeMap[T]['resultMap']['info']

export type ScrapeProviderOf<T extends ScraperMediaType> = ScraperHandlerTypeMap[T]['provider'] &
  RegisteredScraperProvider & {
    search?(query: string, ctx: ScraperProviderContext): Promise<ScrapeSearchResultOf<T>[]>
    resolve(
      lookup: ScrapeLookupOf<T>,
      ctx: ScraperProviderContext
    ): Promise<IdResolvedTarget | null>
    openSession(target: IdResolvedTarget, ctx: ScraperProviderContext): Promise<ScrapeSessionOf<T>>
  }

/** Distributive slot-result unions, identical to the per-entity result types. */
export type ScrapeResultOf<T extends ScraperMediaType> = {
  [S in ScrapeSlotOf<T>]: SlotResult<S, ScrapeResultMapOf<T>[S]>
}[ScrapeSlotOf<T>]
export type ScrapeImageResultOf<T extends ScraperMediaType> = {
  [S in ScrapeImageSlotOf<T>]: SlotResult<S, ScrapeResultMapOf<T>[S]>
}[ScrapeImageSlotOf<T>]

export interface ScraperHandlerSpec<T extends ScraperMediaType> {
  slots: readonly ScrapeSlotOf<T>[]
  /**
   * Total-parses hook-transformed lookup facts back into the contract.
   * Absent for entities whose lookup carries no facts beyond the base shape.
   */
  normalizeLookupFacts?(lookup: ScrapeLookupOf<T>): ScrapeLookupOf<T>
  mergeBundle(
    results: ScrapeResultOf<T>[],
    profile: ScraperProfile,
    identities: readonly ScrapedEntityIdentity[]
  ): ScrapeBundleOf<T> | null
  mergeImages(results: ScrapeImageResultOf<T>[], strategy: SlotStrategy): string[]
}

export const SCRAPER_HANDLER_SPECS = {
  game: {
    slots: GAME_SCRAPER_SLOTS,
    normalizeLookupFacts: normalizeMediaLookupFacts,
    mergeBundle: mergeGameScraperBundle,
    mergeImages: mergeGameScraperImages
  },
  anime: {
    slots: ANIME_SCRAPER_SLOTS,
    normalizeLookupFacts: normalizeAnimeLookupFacts,
    mergeBundle: mergeAnimeScraperBundle,
    mergeImages: mergeAnimeScraperImages
  },
  comic: {
    slots: COMIC_SCRAPER_SLOTS,
    normalizeLookupFacts: normalizeComicLookupFacts,
    mergeBundle: mergeComicScraperBundle,
    mergeImages: mergeComicScraperImages
  },
  novel: {
    slots: NOVEL_SCRAPER_SLOTS,
    normalizeLookupFacts: normalizeNovelLookupFacts,
    mergeBundle: mergeNovelScraperBundle,
    mergeImages: mergeNovelScraperImages
  },
  person: {
    slots: PERSON_SCRAPER_SLOTS,
    mergeBundle: mergePersonScraperBundle,
    mergeImages: mergePersonScraperImages
  },
  company: {
    slots: COMPANY_SCRAPER_SLOTS,
    mergeBundle: mergeCompanyScraperBundle,
    mergeImages: mergeCompanyScraperImages
  },
  character: {
    slots: CHARACTER_SCRAPER_SLOTS,
    mergeBundle: mergeCharacterScraperBundle,
    mergeImages: mergeCharacterScraperImages
  }
} as const satisfies { [T in ScraperMediaType]: ScraperHandlerSpec<T> }
