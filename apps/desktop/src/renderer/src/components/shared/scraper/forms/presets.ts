/**
 * Scraper Presets
 *
 * Universal preset type definitions and preset registry.
 * Presets are code-only configurations that can be used to quickly create profiles.
 */

import type { ContentEntityType } from '@shared/common'
import type { ContentLocale } from '@shared/i18n'
import type { ScraperSlotConfigs } from '@shared/db'
import {
  createExtensionScraperProviderId,
  createSlotConfig,
  createEmptySlotConfig
} from '@shared/scraper'
import { messages } from '@renderer/core/i18n'

const BANGUMI_PROVIDER_ID = createExtensionScraperProviderId('builtin.bangumi', 'bangumi')
const TMDB_PROVIDER_ID = createExtensionScraperProviderId('builtin.tmdb', 'tmdb')
const YMGAL_PROVIDER_ID = createExtensionScraperProviderId('builtin.ymgal', 'ymgal')
const VNDB_PROVIDER_ID = createExtensionScraperProviderId('builtin.vndb', 'vndb')
const IGDB_PROVIDER_ID = createExtensionScraperProviderId('builtin.igdb', 'igdb')

// =============================================================================
// Preset Types
// =============================================================================

/** Scraper preset definition (code-only, never stored in DB) */
export interface ScraperPreset {
  id: string
  /** Localized display name resolved from the current UI locale. */
  name: string
  /** Localized description resolved from the current UI locale. */
  description: string
  mediaType: ContentEntityType
  defaultLocale?: ContentLocale
  searchProviderId: string
  slotConfigs: ScraperSlotConfigs
}

// =============================================================================
// Game Presets
// =============================================================================

type ScraperPresetDefinition = Omit<ScraperPreset, 'name' | 'description'> & {
  copy: (m: typeof messages.value) => { name: string; description: string }
}

/**
 * Visual novel preset pairing VNDB with YMGal and Bangumi.
 *
 * VNDB searches and owns the entry: its catalogue is the most complete for
 * visual novels and it is the only one of the three that states VN-to-VN
 * relations. YMGal leads on the facts a Chinese-language library wants —
 * localized titles, staff, and the developer — and Bangumi fills the rest.
 */
const VISUAL_NOVEL_CN: ScraperPresetDefinition = {
  id: 'visual-novel-cn',
  copy: (m) => m.scraper.presets.visualNovel,
  mediaType: 'game',
  defaultLocale: 'zh-Hans',
  searchProviderId: VNDB_PROVIDER_ID,
  slotConfigs: {
    info: createSlotConfig('info', [YMGAL_PROVIDER_ID, VNDB_PROVIDER_ID], { strategy: 'enrich' }),
    tags: createSlotConfig('tags', [VNDB_PROVIDER_ID], { strategy: 'enrich' }),
    characters: createSlotConfig(
      'characters',
      [YMGAL_PROVIDER_ID, VNDB_PROVIDER_ID, BANGUMI_PROVIDER_ID],
      { strategy: 'enrich' }
    ),
    persons: createSlotConfig('persons', [
      YMGAL_PROVIDER_ID,
      VNDB_PROVIDER_ID,
      BANGUMI_PROVIDER_ID
    ]),
    companies: createSlotConfig('companies', [
      YMGAL_PROVIDER_ID,
      VNDB_PROVIDER_ID,
      BANGUMI_PROVIDER_ID
    ]),
    relatedEntries: createSlotConfig('relatedEntries', [VNDB_PROVIDER_ID, BANGUMI_PROVIDER_ID], {
      strategy: 'enrich'
    }),
    covers: createSlotConfig('covers', [VNDB_PROVIDER_ID, YMGAL_PROVIDER_ID, BANGUMI_PROVIDER_ID]),
    backdrops: createSlotConfig('backdrops', [VNDB_PROVIDER_ID]),
    logos: createEmptySlotConfig('logos'),
    icons: createEmptySlotConfig('icons')
  }
}

/**
 * Video game preset on IGDB, the broadest catalogue for non-visual-novel
 * games. IGDB states no staff credits, so the persons slot stays empty.
 */
const VIDEO_GAME: ScraperPresetDefinition = {
  id: 'video-game',
  copy: (m) => m.scraper.presets.videoGame,
  mediaType: 'game',
  defaultLocale: 'en',
  searchProviderId: IGDB_PROVIDER_ID,
  slotConfigs: {
    info: createSlotConfig('info', [IGDB_PROVIDER_ID], { strategy: 'enrich' }),
    tags: createSlotConfig('tags', [IGDB_PROVIDER_ID], { strategy: 'enrich' }),
    characters: createSlotConfig('characters', [IGDB_PROVIDER_ID], { strategy: 'enrich' }),
    persons: createEmptySlotConfig('persons'),
    companies: createSlotConfig('companies', [IGDB_PROVIDER_ID]),
    relatedEntries: createEmptySlotConfig('relatedEntries'),
    covers: createSlotConfig('covers', [IGDB_PROVIDER_ID]),
    backdrops: createSlotConfig('backdrops', [IGDB_PROVIDER_ID]),
    logos: createEmptySlotConfig('logos'),
    icons: createEmptySlotConfig('icons')
  }
}

// =============================================================================
// Anime Presets
// =============================================================================

/**
 * Anime preset pairing Bangumi with TMDB.
 *
 * Bangumi searches and owns the entry, since its anime catalogue matches the
 * one-entry-per-season shape of the library; TMDB fills what Bangumi lacks,
 * above all backdrops and logos. Episodes stay on `first` so a single source
 * decides the numbering instead of two orderings being spliced together.
 *
 * A missing TMDB key fails only TMDB's own tasks, so the profile still scrapes
 * everything Bangumi covers; the pairing therefore needs no Bangumi-only twin.
 */
const ANIME: ScraperPresetDefinition = {
  id: 'anime',
  copy: (m) => m.scraper.presets.anime,
  mediaType: 'anime',
  defaultLocale: 'zh-Hans',
  searchProviderId: BANGUMI_PROVIDER_ID,
  slotConfigs: {
    info: createSlotConfig('info', [BANGUMI_PROVIDER_ID, TMDB_PROVIDER_ID], {
      strategy: 'enrich'
    }),
    tags: createSlotConfig('tags', [BANGUMI_PROVIDER_ID, TMDB_PROVIDER_ID], {
      strategy: 'enrich'
    }),
    episodes: createSlotConfig('episodes', [BANGUMI_PROVIDER_ID, TMDB_PROVIDER_ID]),
    characters: createSlotConfig('characters', [BANGUMI_PROVIDER_ID]),
    persons: createSlotConfig('persons', [BANGUMI_PROVIDER_ID, TMDB_PROVIDER_ID], {
      strategy: 'enrich'
    }),
    companies: createSlotConfig('companies', [BANGUMI_PROVIDER_ID, TMDB_PROVIDER_ID], {
      strategy: 'enrich'
    }),
    relatedEntries: createSlotConfig('relatedEntries', [BANGUMI_PROVIDER_ID]),
    covers: createSlotConfig('covers', [BANGUMI_PROVIDER_ID, TMDB_PROVIDER_ID], {
      strategy: 'enrich'
    }),
    backdrops: createSlotConfig('backdrops', [TMDB_PROVIDER_ID, BANGUMI_PROVIDER_ID], {
      strategy: 'enrich'
    }),
    logos: createSlotConfig('logos', [TMDB_PROVIDER_ID])
  }
}

// =============================================================================
// Preset Registry
// =============================================================================

const PRESET_DEFINITIONS: ScraperPresetDefinition[] = [VISUAL_NOVEL_CN, VIDEO_GAME, ANIME]

function resolvePreset({ copy, ...preset }: ScraperPresetDefinition): ScraperPreset {
  return { ...preset, ...copy(messages.value) }
}

/** All scraper presets with copy resolved for the current UI locale. */
export function getScraperPresets(): ScraperPreset[] {
  return PRESET_DEFINITIONS.map(resolvePreset)
}
