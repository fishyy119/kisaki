/**
 * Scanner list data.
 *
 * Loaded during navigation by the route loader and kept fresh by the db
 * change feed; the page reads it through `useScanners`.
 */

import type { Ref } from 'vue'
import { computed } from 'vue'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import type { Scanner } from '@shared/db'
import { useDbChanges } from '@renderer/composables/use-db-changes'

export interface ScannersView {
  scanners: Ref<Scanner[]>
  error: Ref<string | null>
  isFetching: Ref<boolean>
  refetch: () => Promise<void>
}

export const scannersData = defineRouteData(async (): Promise<Scanner[]> => {
  return await db.query.scanners.findMany()
})

export function useScanners(): ScannersView {
  const { data, error, isFetching, refetch } = scannersData()

  const scanners = computed(() => data.value ?? [])

  useDbChanges(({ tables }) => {
    if (tables.has('scanners')) refetch()
  })

  return { scanners, error, isFetching, refetch }
}
