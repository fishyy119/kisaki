/**
 * Scanner Composable
 *
 * Provider/Consumer pattern for scanner list data.
 * Data loads during navigation via the route loader.
 */

import type { InjectionKey, Ref } from 'vue'
import { computed, inject, provide } from 'vue'
import { db } from '@renderer/core/db'
import { defineRouteData } from '@renderer/core/route-data'
import type { Scanner } from '@shared/db'
import { useDbChanges } from '@renderer/composables/use-db-changes'

// =============================================================================
// Types
// =============================================================================

export interface ScannerContext {
  scanners: Ref<Scanner[]>
  error: Ref<string | null>
  isFetching: Ref<boolean>
  refetch: () => Promise<void>
}

export const ScannerKey: InjectionKey<ScannerContext> = Symbol('scanner')

// =============================================================================
// Route Loader & Provider
// =============================================================================

export const scannersData = defineRouteData(async (): Promise<Scanner[]> => {
  return await db.query.scanners.findMany()
})

/**
 * Provides scanner list data to child components.
 * Call this in the scanner page root component.
 */
export function useScannerProvider(): ScannerContext {
  const { data, error, isFetching, refetch } = scannersData()

  // Computed to always return array
  const scanners = computed(() => data.value ?? [])

  // Listen for DB events
  useDbChanges(({ table }) => {
    if (table === 'scanners') refetch()
  })

  const context: ScannerContext = {
    scanners,
    error,
    isFetching,
    refetch
  }

  provide(ScannerKey, context)
  return context
}

// =============================================================================
// Consumer
// =============================================================================

/**
 * Access scanner list data from a child component.
 * Must be used within a component tree that called useScannerProvider().
 */
export function useScanner(): ScannerContext {
  const context = inject(ScannerKey)
  if (!context) {
    throw new Error('useScanner() must be used within a component that called useScannerProvider()')
  }
  return context
}
