/**
 * Scraper Presets
 *
 * Universal preset type definitions and preset registry.
 * Presets are code-only configurations that can be used to quickly create profiles.
 */

import type { ContentEntityType } from '@shared/common'
import type { Locale } from '@shared/locale'
import type { ScraperSlotConfigs } from '@shared/db'
import {
  createExtensionScraperProviderId,
  createSlotConfig,
  createEmptySlotConfig
} from '@shared/scraper'

const BANGUMI_PROVIDER_ID = createExtensionScraperProviderId('builtin.bangumi', 'bangumi')

// =============================================================================
// Preset Types
// =============================================================================

/** Scraper preset definition (code-only, never stored in DB) */
export interface ScraperPreset {
  id: string
  name: string
  description: string
  mediaType: ContentEntityType
  defaultLocale?: Locale
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

/** Visual Novel preset using VNDB as the sole data source */
const VISUAL_NOVEL_CN: ScraperPreset = {
  id: PRESET_IDS.VISUAL_NOVEL_CN,
  name: '视觉小说',
  description: '适合获取视觉小说的中文元数据',
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
    covers: createSlotConfig('covers', ['vndb', 'ymgal', BANGUMI_PROVIDER_ID]),
    backdrops: createSlotConfig('backdrops', ['vndb']),
    logos: createEmptySlotConfig('logos'),
    icons: createEmptySlotConfig('icons')
  }
}

const VIDEO_GAME: ScraperPreset = {
  id: 'video-game',
  name: 'Video Game',
  description: 'A general-purpose preset for video games',
  mediaType: 'game',
  defaultLocale: 'en',
  searchProviderId: 'igdb',
  slotConfigs: {
    info: createSlotConfig('info', ['igdb'], { strategy: 'enrich' }),
    tags: createSlotConfig('tags', ['igdb'], { strategy: 'enrich' }),
    characters: createSlotConfig('characters', ['igdb'], { strategy: 'enrich' }),
    persons: createSlotConfig('persons', ['igdb']),
    companies: createSlotConfig('companies', ['igdb']),
    covers: createSlotConfig('covers', ['igdb']),
    backdrops: createSlotConfig('backdrops', ['igdb']),
    logos: createEmptySlotConfig('logos'),
    icons: createEmptySlotConfig('icons')
  }
}

// =============================================================================
// Preset Registry
// =============================================================================

/** All scraper presets */
export const SCRAPER_PRESETS: ScraperPreset[] = [VISUAL_NOVEL_CN, VIDEO_GAME]

/** Get a preset by ID */
export function getPresetById(presetId: string): ScraperPreset | undefined {
  return SCRAPER_PRESETS.find((p) => p.id === presetId)
}

/** Get presets by media type */
export function getPresetsByMediaType(mediaType: ContentEntityType): ScraperPreset[] {
  return SCRAPER_PRESETS.filter((p) => p.mediaType === mediaType)
}
