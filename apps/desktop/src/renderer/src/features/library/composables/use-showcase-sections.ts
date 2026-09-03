/**
 * Composable: useShowcaseSections
 *
 * Route query of the showcase: the section list and every section's entities,
 * loaded together so the page's first frame is complete. Each section is one
 * filtered entity query; its read tables come from the filter it declares.
 */

import { computed } from 'vue'
import { eq, asc } from 'drizzle-orm'
import { newId } from '@shared/id'
import { db, queryEntities, type EntityRowMap } from '@renderer/core/db'
import { defineRouteQuery } from '@renderer/core/query'
import { visibilityView } from '@renderer/stores'
import { showcaseSections, type ShowcaseSection, type NewShowcaseSection } from '@shared/db'
import type { TableName } from '@shared/db/table-names'
import { ALL_ENTITY_TYPES } from '@shared/entity-types'
import { getAllFilterReadTables, getFilterReadTables } from '@shared/filter'

// =============================================================================
// Types
// =============================================================================

export type SectionEntityData = EntityRowMap[keyof EntityRowMap]

export interface ShowcaseSectionData {
  section: ShowcaseSection
  entities: SectionEntityData[]
}

// =============================================================================
// Route query
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

export const showcaseQuery = defineRouteQuery({
  name: 'showcase',
  key: () => 'showcase',
  view: visibilityView,
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
    // The section list itself, plus what every visible section's filter reads.
    // Until the sections are known, every table any filter can read.
    tables: ({ data }) => {
      const tables = new Set<TableName>(['showcase_sections'])
      if (!data) {
        for (const type of ALL_ENTITY_TYPES) {
          for (const table of getAllFilterReadTables(type)) tables.add(table)
        }
        return [...tables]
      }
      for (const { section } of data) {
        if (!section.isVisible) continue
        for (const table of getFilterReadTables(section.entityType, section.filter)) {
          tables.add(table)
        }
      }
      return [...tables]
    }
  }
})

export function useShowcaseSections() {
  const { data, error } = showcaseQuery()

  return {
    sections: computed(() => data.value ?? []),
    error
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
