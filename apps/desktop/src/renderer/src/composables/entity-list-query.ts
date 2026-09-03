/**
 * Entity list query.
 *
 * The user-facing query state every browse surface holds: which content
 * entity type to show, free-text search, a filter, and a sort. Values are
 * replaced wholesale, never mutated, so a shallow holder sees every change.
 * Pure over the shared contracts, so route queries import it directly.
 */

import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/entity-types'
import {
  createEmptyFilter,
  createMembershipSort,
  getFilterQuerySpec,
  hasConditions,
  isMembershipSort,
  type EntitySort,
  type FilterState
} from '@shared/filter'
import { hasActiveSearch } from '@shared/search'
import type { ContentEntityCounts } from './content-entities'

export interface EntityListQuery {
  /**
   * Requested type; `null` lets the surface open on its first type with
   * items. The resolved type travels with the fetched data, never back here.
   */
  readonly entityType: ContentEntityType | null
  readonly search: string
  readonly filter: FilterState
  readonly sort: EntitySort
}

/** Detail params of the organizer surfaces (tag, collection). */
export interface OrganizerDetailParams {
  query: EntityListQuery
}

export function createEntityListQuery(entityType: ContentEntityType | null): EntityListQuery {
  return { entityType, search: '', filter: createEmptyFilter(), sort: createMembershipSort() }
}

/**
 * Search and filter are bound to the type's spec and reset; the sort survives
 * when the new type declares its key.
 */
export function switchEntityListType(
  query: EntityListQuery,
  entityType: ContentEntityType
): EntityListQuery {
  const keepsSort =
    isMembershipSort(query.sort) || getFilterQuerySpec(entityType).sortByKey.has(query.sort.key)

  return {
    entityType,
    search: '',
    filter: createEmptyFilter(),
    sort: keepsSort ? query.sort : createMembershipSort()
  }
}

export function clearEntityListQuery(query: EntityListQuery): EntityListQuery {
  return { ...query, search: '', filter: createEmptyFilter() }
}

export function hasActiveEntityListQuery(query: EntityListQuery): boolean {
  return hasActiveSearch(query.search) || hasConditions(query.filter)
}

/**
 * The requested type when the surface offers it, else the first candidate
 * with items, else the first candidate.
 */
export function resolveEntityListType(
  requested: ContentEntityType | null,
  counts: ContentEntityCounts,
  candidates: readonly ContentEntityType[] = CONTENT_ENTITY_TYPES
): ContentEntityType {
  const offered = candidates.length > 0 ? candidates : CONTENT_ENTITY_TYPES
  if (requested && offered.includes(requested)) return requested
  return offered.find((type) => counts[type] > 0) ?? offered[0]!
}
