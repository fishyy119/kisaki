/**
 * Showcase Section Presets
 *
 * Predefined section configurations for quick showcase setup. Every media
 * type offers the same five presets, generated from one shape list; satellite
 * and organizer presets stay hand-written. Names and descriptions resolve
 * from the active message catalog.
 */

import { messages } from '@renderer/core/i18n'
import type { Messages } from '@shared/i18n'
import { MEDIA_TYPES, type AllEntityType, type MediaType } from '@shared/entity-types'
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

type MediaPresetCopyKey = keyof Messages['library']['showcase']['presets']['media'][MediaType]

type SatellitePresetCopyKey = Exclude<keyof Messages['library']['showcase']['presets'], 'media'>

type PresetShape = Omit<ShowcaseSectionPreset, 'id' | 'name' | 'description' | 'entityType'>

function createFavoritesFilter(): FilterState {
  return { match: 'all', conditions: [{ field: 'isFavorite', op: 'is', value: true }] }
}

// =============================================================================
// Media presets (uniform five per media type)
// =============================================================================

/** The five preset shapes every media type offers, keyed by copy entry. */
function buildMediaPresetShapes(): Record<MediaPresetCopyKey, PresetShape> {
  return {
    recentlyActive: {
      layout: 'horizontal',
      itemSize: 'md',
      limit: 20,
      filter: createEmptyFilter(),
      sortField: 'lastActiveAt',
      sortDirection: 'desc'
    },
    topRated: {
      layout: 'horizontal',
      itemSize: 'md',
      limit: 20,
      filter: createEmptyFilter(),
      sortField: 'score',
      sortDirection: 'desc'
    },
    recentlyAdded: {
      layout: 'horizontal',
      itemSize: 'md',
      limit: 20,
      filter: createEmptyFilter(),
      sortField: 'createdAt',
      sortDirection: 'desc'
    },
    favorites: {
      layout: 'horizontal',
      itemSize: 'md',
      limit: null,
      filter: createFavoritesFilter(),
      sortField: 'name',
      sortDirection: 'asc'
    },
    all: {
      layout: 'grid',
      itemSize: 'md',
      limit: null,
      filter: createEmptyFilter(),
      sortField: 'name',
      sortDirection: 'asc'
    }
  }
}

function buildMediaPresets(
  presetCopy: Messages['library']['showcase']['presets'],
  mediaType: MediaType
): ShowcaseSectionPreset[] {
  const shapes = buildMediaPresetShapes()
  const copy = presetCopy.media[mediaType]

  return (Object.keys(shapes) as MediaPresetCopyKey[]).map((copyKey) => ({
    id: `${mediaType}-${copyKey}`,
    name: copy[copyKey].name,
    description: copy[copyKey].description,
    entityType: mediaType,
    ...shapes[copyKey]
  }))
}

// =============================================================================
// Satellite and organizer presets
// =============================================================================

interface SatellitePresetDefinition {
  id: string
  copyKey: SatellitePresetCopyKey
  entityType: AllEntityType
  shape: PresetShape
}

function buildSatellitePresetDefinitions(): SatellitePresetDefinition[] {
  const favoritesShape = (): PresetShape => ({
    layout: 'horizontal',
    itemSize: 'md',
    limit: null,
    filter: createFavoritesFilter(),
    sortField: 'name',
    sortDirection: 'asc'
  })

  return [
    {
      id: 'favorite-characters',
      copyKey: 'favoriteCharacters',
      entityType: 'character',
      shape: favoritesShape()
    },
    {
      id: 'favorite-persons',
      copyKey: 'favoritePersons',
      entityType: 'person',
      shape: favoritesShape()
    },
    {
      id: 'favorite-companies',
      copyKey: 'favoriteCompanies',
      entityType: 'company',
      shape: favoritesShape()
    },
    {
      id: 'all-collections',
      copyKey: 'allCollections',
      entityType: 'collection',
      shape: {
        layout: 'horizontal',
        itemSize: 'md',
        limit: 20,
        filter: createEmptyFilter(),
        sortField: 'order',
        sortDirection: 'asc'
      }
    },
    {
      id: 'all-tags',
      copyKey: 'allTags',
      entityType: 'tag',
      shape: {
        layout: 'horizontal',
        itemSize: 'md',
        limit: 20,
        filter: createEmptyFilter(),
        sortField: 'name',
        sortDirection: 'asc'
      }
    }
  ]
}

// =============================================================================
// Public API
// =============================================================================

export function getShowcaseSectionPresets(): ShowcaseSectionPreset[] {
  const presetCopy = messages.value.library.showcase.presets

  return [
    ...MEDIA_TYPES.flatMap((mediaType) => buildMediaPresets(presetCopy, mediaType)),
    ...buildSatellitePresetDefinitions().map(({ id, copyKey, entityType, shape }) => ({
      id,
      name: presetCopy[copyKey].name,
      description: presetCopy[copyKey].description,
      entityType,
      ...shape
    }))
  ]
}
