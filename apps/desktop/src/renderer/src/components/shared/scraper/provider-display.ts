import type { ContentEntityType } from '@shared/common'
import { parseExtensionScraperProviderId } from '@shared/scraper'
import type {
  AnimeScraperProviderInfo,
  CharacterScraperProviderInfo,
  CompanyScraperProviderInfo,
  GameScraperProviderInfo,
  PersonScraperProviderInfo,
  ScraperCapability
} from '@shared/scraper'
import { extensionContributionStore } from '@renderer/core/extensions'
import { messages } from '@renderer/core/i18n'

export type ScraperProviderInfo =
  | GameScraperProviderInfo
  | AnimeScraperProviderInfo
  | PersonScraperProviderInfo
  | CompanyScraperProviderInfo
  | CharacterScraperProviderInfo

export type ScraperProvidersByType = Record<ContentEntityType, ScraperProviderInfo[]>

export type ScraperProviderAvailability = 'available' | 'unavailable' | 'unsupported'

export interface ScraperProviderDisplay {
  id: string
  label: string
  status: ScraperProviderAvailability
  statusLabel: string | null
  /** Extension that contributes this provider, for telling same-named ones apart. */
  ownerName: string | null
  provider: ScraperProviderInfo | null
}

function toProviderTitle(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Builds a readable fallback name for a stored provider id.
 */
export function formatScraperProviderFallbackName(providerId: string): string {
  const extensionProvider = parseExtensionScraperProviderId(providerId)
  return extensionProvider ? toProviderTitle(extensionProvider.providerId) : providerId
}

/**
 * Name of the extension a provider belongs to.
 *
 * Every provider is contributed by an extension, and two extensions may cover
 * the same source, so the owner is what tells otherwise identical entries
 * apart. The live contribution snapshot is authoritative; a provider missing
 * from it is not running, and the id's own extension segment stands in.
 */
export function resolveScraperProviderOwnerName(providerId: string): string | null {
  const parts = parseExtensionScraperProviderId(providerId)
  if (!parts) {
    return null
  }

  const registration = extensionContributionStore.scraperProviders.value.find(
    (entry) => entry.extensionId === parts.extensionId && entry.provider.id === parts.providerId
  )

  return registration?.extensionName ?? parts.extensionId
}

/**
 * Resolves provider display state against the current runtime provider list.
 */
export function getScraperProviderDisplay(
  providerId: string,
  providers: readonly ScraperProviderInfo[],
  requiredCapabilities: readonly ScraperCapability[] = []
): ScraperProviderDisplay {
  const ownerName = resolveScraperProviderOwnerName(providerId)
  const provider = providers.find((entry) => entry.id === providerId) ?? null
  if (!provider) {
    return {
      id: providerId,
      label: formatScraperProviderFallbackName(providerId),
      status: 'unavailable',
      statusLabel: messages.value.scraper.providerSelect.unavailable,
      ownerName,
      provider: null
    }
  }

  const supportsRequiredCapabilities = requiredCapabilities.every((capability) =>
    provider.capabilities.includes(capability)
  )

  return {
    id: providerId,
    label: provider.name,
    status: supportsRequiredCapabilities ? 'available' : 'unsupported',
    statusLabel: supportsRequiredCapabilities
      ? null
      : messages.value.scraper.providerSelect.unsupported,
    ownerName,
    provider
  }
}
