/**
 * Composable: useShowcaseSections
 *
 * Route-loaded showcase sections list.
 */

import { computed } from 'vue'
import { eq, asc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { showcaseSections, type ShowcaseSection, type NewShowcaseSection } from '@shared/db'
import { useDbChanges } from '@renderer/composables/use-db-changes'

// =============================================================================
// Route Loader & Composable
// =============================================================================

export const showcaseSectionsData = defineRouteData(async (): Promise<ShowcaseSection[]> => {
  return await db.query.showcaseSections.findMany({
    orderBy: asc(showcaseSections.order)
  })
})

export function useShowcaseSections() {
  const { data, error, isFetching, refetch } = showcaseSectionsData()

  // Listen for DB events
  useDbChanges(({ tables }) => {
    if (tables.has('showcase_sections')) refetch()
  })

  return {
    sections: computed(() => data.value ?? []),
    error,
    isFetching,
    refetch
  }
}

// =============================================================================
// Actions
// =============================================================================

/** Create a new showcase section */
export async function createSection(data: Omit<NewShowcaseSection, 'id'>): Promise<string> {
  const id = nanoid()
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
