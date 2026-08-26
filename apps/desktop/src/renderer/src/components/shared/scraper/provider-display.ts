import type { ContentEntityType } from '@shared/common'
import { parseExtensionScraperProviderId } from '@shared/scraper'
import type {
  AnimeScraperProviderInfo,
  CharacterScraperProviderInfo,
  ComicScraperProviderInfo,
  CompanyScraperProviderInfo,
  GameScraperProviderInfo,
  NovelScraperProviderInfo,
  PersonScraperProviderInfo,
  ScraperCapability
} from '@shared/scraper'
import { messages } from '@renderer/core/i18n'

export type ScraperProviderInfo =
  | GameScraperProviderInfo
  | AnimeScraperProviderInfo
  | ComicScraperProviderInfo
  | NovelScraperProviderInfo
  | PersonScraperProviderInfo
  | CompanyScraperProviderInfo
  | CharacterScraperProviderInfo

export type ScraperProvidersByType = Record<ContentEntityType, ScraperProviderInfo[]>

export type ScraperProviderAvailability = 'available' | 'unavailable' | 'unsupported'

export interface ScraperProviderDisplay {
  /** Raw provider id; carries the extension namespace, shown as the disambiguator. */
  id: string
  label: string
  status: ScraperProviderAvailability
  statusLabel: string | null
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
 * Resolves provider display state against the current runtime provider list.
 */
export function getScraperProviderDisplay(
  providerId: string,
  providers: readonly ScraperProviderInfo[],
  requiredCapabilities: readonly ScraperCapability[] = []
): ScraperProviderDisplay {
  const provider = providers.find((entry) => entry.id === providerId) ?? null
  if (!provider) {
    return {
      id: providerId,
      label: formatScraperProviderFallbackName(providerId),
      status: 'unavailable',
      statusLabel: messages.value.scraper.providerSelect.unavailable,
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
    provider
  }
}
