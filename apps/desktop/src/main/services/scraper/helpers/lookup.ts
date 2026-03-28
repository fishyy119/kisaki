import { normalizeExternalIds, normalizeKeyText } from '@shared/identity'
import type { ScraperProviderDeps } from '../types'

export function findKnownId(
  lookup: Parameters<ScraperProviderDeps['helper']['lookup']['findKnownId']>[0],
  providerId: string
): string | undefined {
  const normalizedProviderId = normalizeKeyText(providerId)

  return normalizeExternalIds(lookup.knownIds).find(
    (externalId) => externalId.source === normalizedProviderId
  )?.id
}
