/**
 * Scraper recipe registry.
 *
 * A recipe is curated ranking knowledge, not a stored object: which providers
 * lead per slot for one usage scene, per language group. Copy stays as
 * message-catalog selectors so names localize at render time, and the two
 * language groups (`zh`, `intl`) parameterize the ordering instead of
 * multiplying preset entries per market.
 *
 * Recipes may rank providers whose extension is missing or lacks a slot
 * capability; materialization filters against the live provider lists, so a
 * recipe never produces dead slot entries.
 */

import type { ContentEntityType } from '@shared/entity-types'
import type { ContentLocale } from '@shared/i18n'
import type { ScraperSlot, SlotStrategy } from '@shared/db'
import { createExtensionScraperProviderId } from '@shared/scraper'
import type { messages } from '@renderer/core/i18n'

type Messages = typeof messages.value

/** Ranking axes; Han-script locales read `zh`, everything else `intl`. */
export type RecipeLanguageGroup = 'zh' | 'intl'

export function resolveRecipeLanguageGroup(locale: ContentLocale): RecipeLanguageGroup {
  return locale === 'zh-Hans' || locale === 'zh-Hant' ? 'zh' : 'intl'
}

export interface ScraperRecipeSlotPlan {
  providerIds: readonly string[]
  strategy: SlotStrategy
}

export interface ScraperRecipeVariant {
  /** Search-source candidates, best first; the first available one is used. */
  searchProviderIds: readonly string[]
  defaultLocale: ContentLocale
  /** Slots absent here stay empty in the materialized profile. */
  slots: Partial<Record<ScraperSlot, ScraperRecipeSlotPlan>>
}

export interface ScraperRecipe {
  /** Stable scene id; stored on profiles created from this recipe. */
  id: string
  entityType: ContentEntityType
  copy: (m: Messages) => { name: string; description: string }
  variants: Record<RecipeLanguageGroup, ScraperRecipeVariant>
}

const BANGUMI = createExtensionScraperProviderId('builtin.bangumi', 'bangumi')
const TMDB = createExtensionScraperProviderId('builtin.tmdb', 'tmdb')
const YMGAL = createExtensionScraperProviderId('builtin.ymgal', 'ymgal')
const VNDB = createExtensionScraperProviderId('builtin.vndb', 'vndb')
const IGDB = createExtensionScraperProviderId('builtin.igdb', 'igdb')
const ANILIST = createExtensionScraperProviderId('builtin.anilist', 'anilist')
const MAL = createExtensionScraperProviderId('builtin.mal', 'mal')
const MANGADEX = createExtensionScraperProviderId('builtin.mangadex', 'mangadex')
const STEAM = createExtensionScraperProviderId('builtin.steam', 'steam')
const STEAMGRIDDB = createExtensionScraperProviderId('builtin.steamgriddb', 'steamgriddb')
const NEODB = createExtensionScraperProviderId('builtin.neodb', 'neodb')
const GOOGLEBOOKS = createExtensionScraperProviderId('builtin.googlebooks', 'googlebooks')

function slot(
  providerIds: readonly string[],
  strategy: SlotStrategy = 'first'
): ScraperRecipeSlotPlan {
  return { providerIds, strategy }
}

/**
 * Visual novels. VNDB owns the search: its catalogue is the most complete and
 * it states VN-to-VN relations. The zh group leads facts with YMGal's
 * Chinese-first data; art gaps fall through to SteamGridDB and Steam.
 */
const GAME_VISUAL_NOVEL: ScraperRecipe = {
  id: 'game.visual-novel',
  entityType: 'game',
  copy: (m) => m.scraper.recipes.gameVisualNovel,
  variants: {
    zh: {
      searchProviderIds: [VNDB, YMGAL, BANGUMI],
      defaultLocale: 'zh-Hans',
      slots: {
        info: slot([YMGAL, VNDB, BANGUMI], 'enrich'),
        tags: slot([VNDB, BANGUMI], 'enrich'),
        characters: slot([YMGAL, VNDB, BANGUMI], 'enrich'),
        persons: slot([YMGAL, VNDB, BANGUMI]),
        companies: slot([YMGAL, VNDB, BANGUMI]),
        relatedEntries: slot([VNDB, BANGUMI], 'enrich'),
        covers: slot([VNDB, YMGAL, BANGUMI]),
        backdrops: slot([VNDB, STEAMGRIDDB, STEAM]),
        logos: slot([STEAMGRIDDB]),
        icons: slot([STEAMGRIDDB])
      }
    },
    intl: {
      searchProviderIds: [VNDB],
      defaultLocale: 'en',
      slots: {
        info: slot([VNDB], 'enrich'),
        tags: slot([VNDB], 'enrich'),
        characters: slot([VNDB], 'enrich'),
        persons: slot([VNDB]),
        companies: slot([VNDB]),
        relatedEntries: slot([VNDB]),
        covers: slot([VNDB, STEAMGRIDDB]),
        backdrops: slot([VNDB, STEAMGRIDDB, STEAM]),
        logos: slot([STEAMGRIDDB]),
        icons: slot([STEAMGRIDDB])
      }
    }
  }
}

/**
 * Video games. IGDB is the broadest catalogue and leads the intl group; the
 * zh group searches Steam first for localized store copy. SteamGridDB leads
 * every art slot and is the only logo and icon source.
 */
const GAME_VIDEO_GAME: ScraperRecipe = {
  id: 'game.video-game',
  entityType: 'game',
  copy: (m) => m.scraper.recipes.gameVideoGame,
  variants: {
    zh: {
      searchProviderIds: [STEAM, IGDB],
      defaultLocale: 'zh-Hans',
      slots: {
        info: slot([STEAM, IGDB, BANGUMI], 'enrich'),
        tags: slot([STEAM, IGDB], 'enrich'),
        characters: slot([IGDB, BANGUMI], 'enrich'),
        persons: slot([BANGUMI]),
        companies: slot([IGDB, STEAM], 'enrich'),
        relatedEntries: slot([IGDB, STEAM], 'enrich'),
        covers: slot([STEAMGRIDDB, STEAM, IGDB]),
        backdrops: slot([STEAMGRIDDB, STEAM, IGDB], 'enrich'),
        logos: slot([STEAMGRIDDB]),
        icons: slot([STEAMGRIDDB])
      }
    },
    intl: {
      searchProviderIds: [IGDB, STEAM],
      defaultLocale: 'en',
      slots: {
        info: slot([IGDB, STEAM], 'enrich'),
        tags: slot([IGDB, STEAM], 'enrich'),
        characters: slot([IGDB], 'enrich'),
        companies: slot([IGDB, STEAM], 'enrich'),
        relatedEntries: slot([IGDB, STEAM], 'enrich'),
        covers: slot([STEAMGRIDDB, IGDB, STEAM]),
        backdrops: slot([STEAMGRIDDB, IGDB, STEAM], 'enrich'),
        logos: slot([STEAMGRIDDB]),
        icons: slot([STEAMGRIDDB])
      }
    }
  }
}

/**
 * Anime. Bangumi's one-entry-per-season catalogue matches the library shape
 * and leads the zh group; AniList leads intl with MAL enriching. Episodes stay
 * on `first` so one source decides the numbering, and TMDB fills landscape
 * art and logos everywhere.
 */
const ANIME: ScraperRecipe = {
  id: 'anime',
  entityType: 'anime',
  copy: (m) => m.scraper.recipes.anime,
  variants: {
    zh: {
      searchProviderIds: [BANGUMI, ANILIST],
      defaultLocale: 'zh-Hans',
      slots: {
        info: slot([BANGUMI, ANILIST, TMDB], 'enrich'),
        tags: slot([BANGUMI, ANILIST], 'enrich'),
        episodes: slot([BANGUMI, TMDB]),
        characters: slot([BANGUMI, ANILIST], 'enrich'),
        persons: slot([BANGUMI, ANILIST, TMDB], 'enrich'),
        companies: slot([BANGUMI, ANILIST, TMDB], 'enrich'),
        relatedEntries: slot([BANGUMI, ANILIST], 'enrich'),
        covers: slot([BANGUMI, ANILIST, TMDB], 'enrich'),
        backdrops: slot([TMDB, ANILIST, BANGUMI], 'enrich'),
        logos: slot([TMDB])
      }
    },
    intl: {
      searchProviderIds: [ANILIST, MAL],
      defaultLocale: 'en',
      slots: {
        info: slot([ANILIST, MAL, TMDB], 'enrich'),
        tags: slot([ANILIST, MAL], 'enrich'),
        episodes: slot([TMDB, MAL]),
        characters: slot([ANILIST, MAL], 'enrich'),
        persons: slot([ANILIST, MAL, TMDB], 'enrich'),
        companies: slot([ANILIST, MAL, TMDB], 'enrich'),
        relatedEntries: slot([ANILIST, MAL], 'enrich'),
        covers: slot([ANILIST, MAL, TMDB], 'enrich'),
        backdrops: slot([TMDB, ANILIST], 'enrich'),
        logos: slot([TMDB])
      }
    }
  }
}

/**
 * Comics. Bangumi leads the zh group, AniList the intl group; MangaDex leads
 * covers everywhere because its per-volume cover art is unmatched, and its
 * entries hand over MAL and AniList ids for the rest of the pipeline.
 */
const COMIC: ScraperRecipe = {
  id: 'comic',
  entityType: 'comic',
  copy: (m) => m.scraper.recipes.comic,
  variants: {
    zh: {
      searchProviderIds: [BANGUMI, MANGADEX, ANILIST],
      defaultLocale: 'zh-Hans',
      slots: {
        info: slot([BANGUMI, MANGADEX, ANILIST], 'enrich'),
        tags: slot([BANGUMI, MANGADEX, ANILIST], 'enrich'),
        chapters: slot([BANGUMI]),
        characters: slot([BANGUMI, ANILIST, MAL], 'enrich'),
        persons: slot([BANGUMI, MANGADEX, ANILIST], 'enrich'),
        companies: slot([BANGUMI, MAL]),
        relatedEntries: slot([BANGUMI, MANGADEX, ANILIST], 'enrich'),
        covers: slot([MANGADEX, BANGUMI, ANILIST]),
        backdrops: slot([ANILIST, BANGUMI])
      }
    },
    intl: {
      searchProviderIds: [ANILIST, MANGADEX, MAL],
      defaultLocale: 'en',
      slots: {
        info: slot([ANILIST, MANGADEX, MAL], 'enrich'),
        tags: slot([ANILIST, MANGADEX, MAL], 'enrich'),
        characters: slot([ANILIST, MAL], 'enrich'),
        persons: slot([ANILIST, MANGADEX, MAL], 'enrich'),
        companies: slot([MAL]),
        relatedEntries: slot([ANILIST, MANGADEX, MAL], 'enrich'),
        covers: slot([MANGADEX, ANILIST, MAL]),
        backdrops: slot([ANILIST])
      }
    }
  }
}

/**
 * Light novels. Bangumi carries volumes and Chinese-first facts for the zh
 * group; AniList and MAL carry the intl group.
 */
const NOVEL_LIGHT_NOVEL: ScraperRecipe = {
  id: 'novel.light-novel',
  entityType: 'novel',
  copy: (m) => m.scraper.recipes.novelLightNovel,
  variants: {
    zh: {
      searchProviderIds: [BANGUMI, ANILIST],
      defaultLocale: 'zh-Hans',
      slots: {
        info: slot([BANGUMI, ANILIST, MAL], 'enrich'),
        tags: slot([BANGUMI, ANILIST], 'enrich'),
        volumes: slot([BANGUMI]),
        characters: slot([BANGUMI, ANILIST, MAL], 'enrich'),
        persons: slot([BANGUMI, ANILIST, MAL], 'enrich'),
        companies: slot([BANGUMI, MAL]),
        relatedEntries: slot([BANGUMI, ANILIST], 'enrich'),
        covers: slot([BANGUMI, ANILIST, MAL]),
        backdrops: slot([ANILIST, BANGUMI])
      }
    },
    intl: {
      searchProviderIds: [ANILIST, MAL],
      defaultLocale: 'en',
      slots: {
        info: slot([ANILIST, MAL], 'enrich'),
        tags: slot([ANILIST, MAL], 'enrich'),
        characters: slot([ANILIST, MAL], 'enrich'),
        persons: slot([ANILIST, MAL], 'enrich'),
        companies: slot([MAL]),
        relatedEntries: slot([ANILIST, MAL], 'enrich'),
        covers: slot([ANILIST, MAL]),
        backdrops: slot([ANILIST])
      }
    }
  }
}

/**
 * General fiction. NeoDB leads the zh group with Chinese bibliographic data
 * and cross-source identifiers; Google Books leads intl with worldwide
 * coverage. The two align on ISBNs, so enrichment stays precise.
 */
const NOVEL_FICTION: ScraperRecipe = {
  id: 'novel.fiction',
  entityType: 'novel',
  copy: (m) => m.scraper.recipes.novelFiction,
  variants: {
    zh: {
      searchProviderIds: [NEODB, GOOGLEBOOKS],
      defaultLocale: 'zh-Hans',
      slots: {
        info: slot([NEODB, GOOGLEBOOKS], 'enrich'),
        tags: slot([NEODB, GOOGLEBOOKS], 'enrich'),
        persons: slot([NEODB, GOOGLEBOOKS], 'enrich'),
        companies: slot([NEODB, GOOGLEBOOKS], 'enrich'),
        covers: slot([NEODB, GOOGLEBOOKS])
      }
    },
    intl: {
      searchProviderIds: [GOOGLEBOOKS, NEODB],
      defaultLocale: 'en',
      slots: {
        info: slot([GOOGLEBOOKS, NEODB], 'enrich'),
        tags: slot([GOOGLEBOOKS, NEODB], 'enrich'),
        persons: slot([GOOGLEBOOKS, NEODB], 'enrich'),
        companies: slot([GOOGLEBOOKS, NEODB], 'enrich'),
        covers: slot([GOOGLEBOOKS, NEODB])
      }
    }
  }
}

/** People (staff, authors, voice actors). */
const PERSON: ScraperRecipe = {
  id: 'person',
  entityType: 'person',
  copy: (m) => m.scraper.recipes.person,
  variants: {
    zh: {
      searchProviderIds: [BANGUMI, ANILIST],
      defaultLocale: 'zh-Hans',
      slots: {
        info: slot([BANGUMI, ANILIST, VNDB, MANGADEX], 'enrich'),
        tags: slot([BANGUMI]),
        photos: slot([BANGUMI, ANILIST, TMDB, MANGADEX])
      }
    },
    intl: {
      searchProviderIds: [ANILIST, TMDB],
      defaultLocale: 'en',
      slots: {
        info: slot([ANILIST, TMDB, VNDB, MANGADEX], 'enrich'),
        photos: slot([ANILIST, TMDB, MANGADEX])
      }
    }
  }
}

/** Companies (studios, publishers, brands). */
const COMPANY: ScraperRecipe = {
  id: 'company',
  entityType: 'company',
  copy: (m) => m.scraper.recipes.company,
  variants: {
    zh: {
      searchProviderIds: [BANGUMI, IGDB],
      defaultLocale: 'zh-Hans',
      slots: {
        info: slot([BANGUMI, VNDB, IGDB], 'enrich'),
        tags: slot([BANGUMI, VNDB]),
        logos: slot([BANGUMI, IGDB, TMDB])
      }
    },
    intl: {
      searchProviderIds: [IGDB, TMDB],
      defaultLocale: 'en',
      slots: {
        info: slot([IGDB, VNDB, TMDB], 'enrich'),
        tags: slot([VNDB]),
        logos: slot([IGDB, TMDB])
      }
    }
  }
}

/** Characters. */
const CHARACTER: ScraperRecipe = {
  id: 'character',
  entityType: 'character',
  copy: (m) => m.scraper.recipes.character,
  variants: {
    zh: {
      searchProviderIds: [BANGUMI, ANILIST],
      defaultLocale: 'zh-Hans',
      slots: {
        info: slot([BANGUMI, ANILIST, VNDB, YMGAL], 'enrich'),
        tags: slot([BANGUMI, VNDB]),
        persons: slot([BANGUMI]),
        photos: slot([BANGUMI, ANILIST, VNDB, YMGAL])
      }
    },
    intl: {
      searchProviderIds: [ANILIST, VNDB],
      defaultLocale: 'en',
      slots: {
        info: slot([ANILIST, VNDB], 'enrich'),
        tags: slot([VNDB]),
        photos: slot([ANILIST, VNDB])
      }
    }
  }
}

export const SCRAPER_RECIPES: readonly ScraperRecipe[] = [
  GAME_VISUAL_NOVEL,
  GAME_VIDEO_GAME,
  ANIME,
  COMIC,
  NOVEL_LIGHT_NOVEL,
  NOVEL_FICTION,
  PERSON,
  COMPANY,
  CHARACTER
]

export function getRecipesForEntityType(entityType: ContentEntityType): ScraperRecipe[] {
  return SCRAPER_RECIPES.filter((recipe) => recipe.entityType === entityType)
}

export function getRecipeById(recipeId: string): ScraperRecipe | undefined {
  return SCRAPER_RECIPES.find((recipe) => recipe.id === recipeId)
}
