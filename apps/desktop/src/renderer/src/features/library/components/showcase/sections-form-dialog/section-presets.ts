/**
 * Showcase Section Presets
 *
 * Predefined section configurations for quick showcase setup.
 * Names and descriptions resolve from the active message catalog.
 */

import { messages } from '@renderer/core/i18n'
import type { Messages } from '@shared/i18n'
import type { AllEntityType } from '@shared/common'
import type { FilterState } from '@shared/filter'
import { createEmptyFilter } from '@shared/filter'
import type { SectionLayout, SectionItemSize } from '@shared/db'

// =============================================================================
// Types
// =============================================================================

export interface ShowcaseSectionPreset {
  id: string
  name: string
  description: string
  entityType: AllEntityType
  layout: SectionLayout
  itemSize: SectionItemSize
  limit: number | null
  filter: FilterState
  sortField: string
  sortDirection: 'asc' | 'desc'
}

type PresetCopyKey = keyof Messages['library']['showcase']['presets']

type PresetDefinition = Omit<ShowcaseSectionPreset, 'name' | 'description'> & {
  copyKey: PresetCopyKey
}

// =============================================================================
// Presets
// =============================================================================

const PRESET_DEFINITIONS: PresetDefinition[] = [
  // Game presets
  {
    id: 'recently-played',
    copyKey: 'recentlyPlayed',
    entityType: 'game',
    layout: 'horizontal',
    itemSize: 'md',
    limit: 20,
    filter: createEmptyFilter(),
    sortField: 'lastActiveAt',
    sortDirection: 'desc'
  },
  {
    id: 'top-rated',
    copyKey: 'topRated',
    entityType: 'game',
    layout: 'horizontal',
    itemSize: 'md',
    limit: 20,
    filter: createEmptyFilter(),
    sortField: 'score',
    sortDirection: 'desc'
  },
  {
    id: 'recently-added',
    copyKey: 'recentlyAdded',
    entityType: 'game',
    layout: 'horizontal',
    itemSize: 'md',
    limit: 20,
    filter: createEmptyFilter(),
    sortField: 'createdAt',
    sortDirection: 'desc'
  },
  {
    id: 'all-games',
    copyKey: 'allGames',
    entityType: 'game',
    layout: 'grid',
    itemSize: 'md',
    limit: null,
    filter: createEmptyFilter(),
    sortField: 'name',
    sortDirection: 'asc'
  },
  {
    id: 'favorite-games',
    copyKey: 'favoriteGames',
    entityType: 'game',
    layout: 'horizontal',
    itemSize: 'md',
    limit: null,
    filter: { match: 'all', conditions: [{ field: 'isFavorite', op: 'is', value: true }] },
    sortField: 'name',
    sortDirection: 'asc'
  },

  // Anime presets
  {
    id: 'recently-watched',
    copyKey: 'recentlyWatched',
    entityType: 'anime',
    layout: 'horizontal',
    itemSize: 'md',
    limit: 20,
    filter: createEmptyFilter(),
    sortField: 'lastActiveAt',
    sortDirection: 'desc'
  },
  {
    id: 'top-rated-anime',
    copyKey: 'topRatedAnime',
    entityType: 'anime',
    layout: 'horizontal',
    itemSize: 'md',
    limit: 20,
    filter: createEmptyFilter(),
    sortField: 'score',
    sortDirection: 'desc'
  },
  {
    id: 'recently-added-anime',
    copyKey: 'recentlyAddedAnime',
    entityType: 'anime',
    layout: 'horizontal',
    itemSize: 'md',
    limit: 20,
    filter: createEmptyFilter(),
    sortField: 'createdAt',
    sortDirection: 'desc'
  },

  // Character presets
  {
    id: 'favorite-characters',
    copyKey: 'favoriteCharacters',
    entityType: 'character',
    layout: 'horizontal',
    itemSize: 'md',
    limit: null,
    filter: { match: 'all', conditions: [{ field: 'isFavorite', op: 'is', value: true }] },
    sortField: 'name',
    sortDirection: 'asc'
  },

  // Person presets
  {
    id: 'favorite-persons',
    copyKey: 'favoritePersons',
    entityType: 'person',
    layout: 'horizontal',
    itemSize: 'md',
    limit: null,
    filter: { match: 'all', conditions: [{ field: 'isFavorite', op: 'is', value: true }] },
    sortField: 'name',
    sortDirection: 'asc'
  },

  // Company presets
  {
    id: 'favorite-companies',
    copyKey: 'favoriteCompanies',
    entityType: 'company',
    layout: 'horizontal',
    itemSize: 'md',
    limit: null,
    filter: { match: 'all', conditions: [{ field: 'isFavorite', op: 'is', value: true }] },
    sortField: 'name',
    sortDirection: 'asc'
  },

  // Collection presets
  {
    id: 'all-collections',
    copyKey: 'allCollections',
    entityType: 'collection',
    layout: 'horizontal',
    itemSize: 'md',
    limit: 20,
    filter: createEmptyFilter(),
    sortField: 'order',
    sortDirection: 'asc'
  },

  // Tag presets
  {
    id: 'all-tags',
    copyKey: 'allTags',
    entityType: 'tag',
    layout: 'horizontal',
    itemSize: 'md',
    limit: 20,
    filter: createEmptyFilter(),
    sortField: 'name',
    sortDirection: 'asc'
  }
]

export function getShowcaseSectionPresets(): ShowcaseSectionPreset[] {
  const presetCopy = messages.value.library.showcase.presets
  return PRESET_DEFINITIONS.map(({ copyKey, ...preset }) => ({
    ...preset,
    name: presetCopy[copyKey].name,
    description: presetCopy[copyKey].description
  }))
}
