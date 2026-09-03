/**
 * Composable: useShowcaseSections
 *
 * Route data of the showcase: the section list and every section's entities,
 * loaded together so the page's first frame is complete. Each section is one
 * filtered entity query; its read tables come from the query it declares.
 */

import { computed } from 'vue'
import { eq, asc, getTableName } from 'drizzle-orm'
import { storeToRefs } from 'pinia'
import { newId } from '@shared/id'
import { db, queryEntities, type EntityRowMap } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { usePreferencesStore } from '@renderer/stores'
import { showcaseSections, type ShowcaseSection, type NewShowcaseSection } from '@shared/db'
import { ENTITY_TABLE_BY_TYPE } from '@shared/db/references'
import type { TableName } from '@shared/db/table-names'
import { getQueryDependencyTables } from '@shared/filter'

/** Every entity table: the read set of a section list whose sections are not known yet. */
const ENTITY_TABLE_NAMES: readonly TableName[] = Object.values(ENTITY_TABLE_BY_TYPE).map(
  (table) => getTableName(table) as TableName
)

// =============================================================================
// Types
// =============================================================================

export type SectionEntityData = EntityRowMap[keyof EntityRowMap]

export interface ShowcaseSectionData {
  section: ShowcaseSection
  entities: SectionEntityData[]
}

// =============================================================================
// Route data
// =============================================================================

async function fetchSectionEntities(
  section: ShowcaseSection,
  showNsfw: boolean
): Promise<SectionEntityData[]> {
  return await queryEntities(section.entityType, {
    filter: section.filter,
    sort: { key: section.sortField, direction: section.sortDirection },
    limit: section.limit ?? undefined,
    includeNsfw: showNsfw
  })
}

export const showcaseData = defineRouteData({
  name: 'showcase',
  key: () => 'showcase',
  view: () => {
    const { showNsfw } = storeToRefs(usePreferencesStore())
    return { showNsfw: showNsfw.value }
  },
  fetch: async ({ view }) => {
    const sections = await db.query.showcaseSections.findMany({
      orderBy: asc(showcaseSections.order)
    })
    return await Promise.all(
      sections.map(async (section) => ({
        section,
        entities: section.isVisible ? await fetchSectionEntities(section, view.showNsfw) : []
      }))
    )
  },
  invalidate: {
    // The section list itself, plus what every visible section's query reads.
    // Until the sections are known, every entity table is a candidate.
    reads: ({ data }) => {
      const tables = new Set<TableName>(['showcase_sections'])
      if (!data) {
        for (const table of ENTITY_TABLE_NAMES) tables.add(table)
        return [...tables]
      }
      for (const { section } of data) {
        if (!section.isVisible) continue
        const query = {
          filter: section.filter,
          sort: { key: section.sortField, direction: section.sortDirection }
        }
        for (const table of getQueryDependencyTables(section.entityType, query)) tables.add(table)
      }
      return [...tables]
    }
  }
})

export function useShowcaseSections() {
  const { data, error, isFetching, reload } = showcaseData()

  return {
    sections: computed(() => data.value ?? []),
    error,
    isFetching,
    refetch: reload
  }
}

// =============================================================================
// Actions
// =============================================================================

/** Create a new showcase section */
export async function createSection(data: Omit<NewShowcaseSection, 'id'>): Promise<string> {
  const id = newId()
  await db.insert(showcaseSections).values({ ...data, id })
  return id
}

/** Update a showcase section */
export async function updateSection(id: string, data: Partial<NewShowcaseSection>): Promise<void> {
  await db.update(showcaseSections).set(data).where(eq(showcaseSections.id, id))
}

/** Delete a showcase section */
export async function deleteSection(id: string): Promise<void> {
  await db.delete(showcaseSections).where(eq(showcaseSections.id, id))
}

/** Reorder sections */
export async function reorderSections(sectionIds: string[]): Promise<void> {
  for (let i = 0; i < sectionIds.length; i++) {
    const id = sectionIds[i]
    if (id !== undefined) {
      await db.update(showcaseSections).set({ order: i }).where(eq(showcaseSections.id, id))
    }
  }
}
