import type { IdResolvedTarget } from '../types'

/**
 * Create the default id-based resolved target shape shared by current scraper media runtimes.
 */
export function createIdResolvedTarget(id: string, resolveName?: string): IdResolvedTarget {
  const normalizedId = id.trim()

  return {
    id: normalizedId,
    cacheKey: normalizedId,
    resolveName: resolveName?.trim() || undefined
  }
}
