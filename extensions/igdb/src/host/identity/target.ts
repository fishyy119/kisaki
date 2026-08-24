import type { ExternalId, IdResolvedTarget } from '@kisaki3/extension-sdk'
import { omitUndefined } from '../utils/object'

/**
 * A resolved scrape target. The id is also the cache key: it names exactly one
 * IGDB entry, so two lookups that reach the same id share a session.
 */
export function toResolvedTarget(
  id: string,
  resolveName?: string,
  externalIds?: readonly ExternalId[]
): IdResolvedTarget {
  return omitUndefined({
    id,
    cacheKey: id,
    resolveName: resolveName?.trim() || undefined,
    identity: externalIds ? { externalIds } : undefined
  })
}
