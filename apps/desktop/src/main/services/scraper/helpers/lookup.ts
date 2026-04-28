import { normalizeExternalIds, normalizeKeyText } from '@shared/identity'
import type { ScraperProviderDeps } from '../types'

export function findKnownId(
  lookup: Parameters<ScraperProviderDeps['helper']['lookup']['findKnownId']>[0],
  externalIdSource: string
): string | undefined {
  const normalizedExternalIdSource = normalizeKeyText(externalIdSource)

  return normalizeExternalIds(lookup.knownIds).find(
    (externalId) => externalId.source === normalizedExternalIdSource
  )?.id
}
