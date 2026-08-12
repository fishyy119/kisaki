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
// Preset IDs
// =============================================================================

export const PRESET_IDS = {
  // Game presets
  VISUAL_NOVEL_CN: 'visual-novel-cn'
} as const

export type PresetId = (typeof PRESET_IDS)[keyof typeof PRESET_IDS]

// =============================================================================
// Game Presets
// =============================================================================

type ScraperPresetDefinition = Omit<ScraperPreset, 'name' | 'description'> & {
  copy: (m: typeof messages.value) => { name: string; description: string }
}

/** Visual Novel preset using VNDB as the sole data source */
const VISUAL_NOVEL_CN: ScraperPresetDefinition = {
  id: PRESET_IDS.VISUAL_NOVEL_CN,
  copy: (m) => m.scraper.presets.visualNovel,
  mediaType: 'game',
  defaultLocale: 'zh-Hans',
  searchProviderId: 'vndb',
  slotConfigs: {
    info: createSlotConfig('info', ['ymgal', 'vndb'], { strategy: 'enrich' }),
    tags: createSlotConfig('tags', ['vndb'], { strategy: 'enrich' }),
    characters: createSlotConfig('characters', ['ymgal', 'vndb', BANGUMI_PROVIDER_ID], {
      strategy: 'enrich'
    }),
    persons: createSlotConfig('persons', ['ymgal', 'vndb', BANGUMI_PROVIDER_ID]),
    companies: createSlotConfig('companies', ['ymgal', 'vndb', BANGUMI_PROVIDER_ID]),
    relatedEntries: createSlotConfig('relatedEntries', ['vndb', BANGUMI_PROVIDER_ID], {
      strategy: 'enrich'
    }),
    covers: createSlotConfig('covers', ['vndb', 'ymgal', BANGUMI_PROVIDER_ID]),
    backdrops: createSlotConfig('backdrops', ['vndb']),
    logos: createEmptySlotConfig('logos'),
    icons: createEmptySlotConfig('icons')
  }
}

const VIDEO_GAME: ScraperPresetDefinition = {
  id: 'video-game',
  copy: (m) => m.scraper.presets.videoGame,
  mediaType: 'game',
  defaultLocale: 'en',
  searchProviderId: 'igdb',
  slotConfigs: {
    info: createSlotConfig('info', ['igdb'], { strategy: 'enrich' }),
    tags: createSlotConfig('tags', ['igdb'], { strategy: 'enrich' }),
    characters: createSlotConfig('characters', ['igdb'], { strategy: 'enrich' }),
    persons: createSlotConfig('persons', ['igdb']),
    companies: createSlotConfig('companies', ['igdb']),
    relatedEntries: createEmptySlotConfig('relatedEntries'),
    covers: createSlotConfig('covers', ['igdb']),
    backdrops: createSlotConfig('backdrops', ['igdb']),
    logos: createEmptySlotConfig('logos'),
    icons: createEmptySlotConfig('icons')
  }
}

// =============================================================================
// Anime Presets
// =============================================================================

/** Anime preset using Bangumi as the sole data source */
const ANIME_CN: ScraperPresetDefinition = {
  id: 'anime-cn',
  copy: (m) => m.scraper.presets.anime,
  mediaType: 'anime',
  defaultLocale: 'zh-Hans',
  searchProviderId: BANGUMI_PROVIDER_ID,
  slotConfigs: {
    info: createSlotConfig('info', [BANGUMI_PROVIDER_ID]),
    tags: createSlotConfig('tags', [BANGUMI_PROVIDER_ID]),
    episodes: createSlotConfig('episodes', [BANGUMI_PROVIDER_ID]),
    characters: createSlotConfig('characters', [BANGUMI_PROVIDER_ID]),
    persons: createSlotConfig('persons', [BANGUMI_PROVIDER_ID]),
    companies: createSlotConfig('companies', [BANGUMI_PROVIDER_ID]),
    relatedEntries: createSlotConfig('relatedEntries', [BANGUMI_PROVIDER_ID]),
    covers: createSlotConfig('covers', [BANGUMI_PROVIDER_ID]),
    backdrops: createSlotConfig('backdrops', [BANGUMI_PROVIDER_ID]),
    logos: createEmptySlotConfig('logos')
  }
}

// =============================================================================
// Preset Registry
// =============================================================================

const PRESET_DEFINITIONS: ScraperPresetDefinition[] = [VISUAL_NOVEL_CN, VIDEO_GAME, ANIME_CN]

function resolvePreset({ copy, ...preset }: ScraperPresetDefinition): ScraperPreset {
  return { ...preset, ...copy(messages.value) }
}

/** All scraper presets with copy resolved for the current UI locale. */
export function getScraperPresets(): ScraperPreset[] {
  return PRESET_DEFINITIONS.map(resolvePreset)
}

/** Get a preset by ID */
export function getPresetById(presetId: string): ScraperPreset | undefined {
  const definition = PRESET_DEFINITIONS.find((p) => p.id === presetId)
  return definition ? resolvePreset(definition) : undefined
}

/** Get presets by media type */
export function getPresetsByMediaType(mediaType: ContentEntityType): ScraperPreset[] {
  return PRESET_DEFINITIONS.filter((p) => p.mediaType === mediaType).map(resolvePreset)
}
