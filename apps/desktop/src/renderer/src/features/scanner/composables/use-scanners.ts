/**
 * Scanner list data.
 *
 * Route data of the scanner page: every scanner with the names its row
 * displays (target collection, scraper profile) resolved in the same load, so
 * the page's first frame is complete and no row issues a lookup of its own.
 */

import { computed, type ComputedRef, type Ref } from 'vue'
import { eq } from 'drizzle-orm'
import { storeToRefs } from 'pinia'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import { usePreferencesStore } from '@renderer/stores'
import { collections, scanners, scraperProfiles, type Scanner } from '@shared/db'

/** A scanner row with the display names its list row shows. */
export interface ScannerListEntry {
  scanner: Scanner
  /** Name of the target collection; null when none is set or it is hidden. */
  targetCollectionName: string | null
  /** Name of the scraper profile; null when none is set. */
  scraperProfileName: string | null
}

export interface ScannersView {
  entries: ComputedRef<ScannerListEntry[]>
  scanners: ComputedRef<Scanner[]>
  error: Ref<string | null>
  isFetching: Ref<boolean>
  refetch: () => Promise<void>
}

export const scannersData = defineRouteData({
  name: 'scanners',
  key: () => 'scanners',
  view: () => {
    const { showNsfw } = storeToRefs(usePreferencesStore())
    return { showNsfw: showNsfw.value }
  },
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
  invalidate: { reads: ['scanners', 'collections', 'scraper_profiles'] }
})

export function useScanners(): ScannersView {
  const { data, error, isFetching, reload } = scannersData()

  const entries = computed(() => data.value ?? [])

  return {
    entries,
    scanners: computed(() => entries.value.map((entry) => entry.scanner)),
    error,
    isFetching,
    refetch: reload
  }
}
