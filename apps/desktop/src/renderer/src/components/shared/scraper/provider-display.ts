import type { ContentEntityType } from '@shared/common'
import type {
  CharacterScraperProviderInfo,
  CompanyScraperProviderInfo,
  GameScraperProviderInfo,
  PersonScraperProviderInfo,
  ScraperCapability
} from '@shared/scraper'

export type ScraperProviderInfo =
  | GameScraperProviderInfo
  | PersonScraperProviderInfo
  | CompanyScraperProviderInfo
  | CharacterScraperProviderInfo

export type ScraperProvidersByType = Record<ContentEntityType, ScraperProviderInfo[]>

export type ScraperProviderAvailability = 'available' | 'unavailable' | 'unsupported'

export interface ScraperProviderDisplay {
  id: string
  label: string
  description: string | null
  status: ScraperProviderAvailability
  statusLabel: string | null
  provider: ScraperProviderInfo | null
}

function decodeProviderPart(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
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
  const extensionMatch = /^ext:([^/]+)\/(.+)$/.exec(providerId)
  if (!extensionMatch) {
    return providerId
  }

  return toProviderTitle(decodeProviderPart(extensionMatch[2]))
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
      description: providerId,
      status: 'unavailable',
      statusLabel: '不可用',
      provider: null
    }
  }

  const supportsRequiredCapabilities = requiredCapabilities.every((capability) =>
    provider.capabilities.includes(capability)
  )

  return {
    id: providerId,
    label: provider.name,
    description: provider.id,
    status: supportsRequiredCapabilities ? 'available' : 'unsupported',
    statusLabel: supportsRequiredCapabilities ? null : '不支持',
    provider
  }
}
