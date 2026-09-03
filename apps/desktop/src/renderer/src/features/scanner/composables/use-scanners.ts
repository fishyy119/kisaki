/**
 * Scanner list data.
 *
 * Route query of the scanner page: every scanner with the names its row
 * displays (target collection, scraper profile) resolved in the same load, so
 * the page's first frame is complete and no row issues a lookup of its own.
 */

import { computed } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { defineRouteQuery } from '@renderer/core/query'
import { visibilityView } from '@renderer/stores'
import { collections, scanners, scraperProfiles, type Scanner } from '@shared/db'

/** A scanner row with the display names its list row shows. */
export interface ScannerListEntry {
  scanner: Scanner
  /** Name of the target collection; null when none is set or it is hidden. */
  targetCollectionName: string | null
  /** Name of the scraper profile; null when none is set. */
  scraperProfileName: string | null
}

export const scannersQuery = defineRouteQuery({
  name: 'scanners',
  key: () => 'scanners',
  view: visibilityView,
  fetch: async ({ view }): Promise<ScannerListEntry[]> => {
    const rows = await db
      .select({
        scanner: scanners,
        collectionName: collections.name,
        collectionIsNsfw: collections.isNsfw,
        profileName: scraperProfiles.name
      })
      .from(scanners)
      .leftJoin(collections, eq(scanners.targetCollectionId, collections.id))
      .leftJoin(scraperProfiles, eq(scanners.scraperProfileId, scraperProfiles.id))

    return rows.map((row) => ({
      scanner: row.scanner,
      // A hidden collection reads as unset, matching how the rest of the app treats it.
      targetCollectionName:
        row.collectionName !== null && (view.showNsfw || !row.collectionIsNsfw)
          ? row.collectionName
          : null,
      scraperProfileName: row.profileName
    }))
  },
  invalidate: { tables: ['scanners', 'collections', 'scraper_profiles'] }
})

export function useScanners() {
  const { data, error } = scannersQuery()

  return {
    entries: computed(() => data.value ?? []),
    error
  }
}
