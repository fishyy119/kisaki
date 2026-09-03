/**
 * Tag data composable
 *
 * The provider/consumer shell (route loader, dialog provider, db sync) comes
 * from the entity detail context factory; this module owns what a tag detail
 * surface fetches and shows: the tag row, member counts per content type, and
 * the members of the browsed type under the surface's list query.
 */

import {
  ENTITY_TABLES,
  TAG_LINKS,
  buildTagMembershipScope,
  countEntities,
  queryEntities,
  queryEntityRow
} from '@renderer/core/db'
import { CONTENT_ENTITY_TYPES, type ContentEntityType } from '@shared/entity-types'
import type { Tag } from '@shared/db/schema'
import type { TableName } from '@shared/db/table-names'
import { getQueryDependencyTables } from '@shared/filter'
import {
  createEmptyContentEntityCounts,
  type ContentEntityCounts,
  type ContentEntityData
} from './content-entities'
import {
  createEntityDetailContext,
  type EntityDetailContext,
  type EntityDetailProviderReturn,
  type EntityDetailReadsContext
} from './entity-context'
import {
  createEntityListQuery,
  resolveEntityListType,
  type EntityListQuery,
  type OrganizerDetailParams
} from './entity-list-query'

// =============================================================================
// Types
// =============================================================================

export interface TagData {
  tag: Tag | null
  /** Members per content type, unfiltered. */
  counts: ContentEntityCounts
  /** Type actually shown; the query only carries the request. */
  entityType: ContentEntityType
  entities: ContentEntityData[]
}

export type TagContext = EntityDetailContext<TagData>
export type TagProviderReturn = EntityDetailProviderReturn<TagData, OrganizerDetailParams>

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchTagData(
  tagId: string,
  query: EntityListQuery,
  showNsfw: boolean
): Promise<TagData | null> {
  const tag = await queryEntityRow('tag', tagId)
  // A hidden tag reads as missing, so both surfaces fall through to not-found.
  if (!tag || (tag.isNsfw && !showNsfw)) return null

  const counts = createEmptyContentEntityCounts()
  await Promise.all(
    CONTENT_ENTITY_TYPES.map(async (type) => {
      counts[type] = await countEntities(type, {
        scope: buildTagMembershipScope(type, tagId),
        includeNsfw: showNsfw
      })
    })
  )

  const entityType = resolveEntityListType(query.entityType, counts)
  const entities = await queryEntities(entityType, {
    scope: buildTagMembershipScope(entityType, tagId),
    search: query.search,
    filter: query.filter,
    sort: query.sort,
    includeNsfw: showNsfw
  })

  return { tag, counts, entityType, entities }
}

/**
 * What the fetch reads. Link rows attribute to the tag through their foreign
 * key, so only this tag's membership changes refetch; every entity table can
 * hide a member and matches by table; the visible list reads the shown
 * type's query tables (every type's until the shown type is known).
 */
function tagReads({
  params,
  data
}: EntityDetailReadsContext<TagData, OrganizerDetailParams>): readonly TableName[] {
  const tables = new Set<TableName>()
  for (const type of CONTENT_ENTITY_TYPES) {
    tables.add(TAG_LINKS[type].tableName)
    tables.add(ENTITY_TABLES[type].tableName)
  }

  const shownType = data?.entityType ?? params.query.entityType
  for (const type of shownType ? [shownType] : CONTENT_ENTITY_TYPES) {
    for (const table of getQueryDependencyTables(type, params.query)) tables.add(table)
  }

  return [...tables]
}

// =============================================================================
// Context
// =============================================================================

const tagDetail = createEntityDetailContext<TagData, OrganizerDetailParams>({
  entityType: 'tag',
  empty: {
    tag: null,
    counts: createEmptyContentEntityCounts(),
    entityType: 'game',
    entities: []
  },
  initialParams: () => ({ query: createEntityListQuery(null) }),
  fetch: (id, params, view) => fetchTagData(id, params.query, view.showNsfw),
  reads: tagReads
})

export const tagDetailData = tagDetail.detailData
export const useTagRouteProvider = tagDetail.useRouteProvider
export const useTagDialogProvider = tagDetail.useDialogProvider
export const useTag = tagDetail.useContext
