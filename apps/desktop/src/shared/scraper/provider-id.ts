/**
 * Scraper provider ids are media-scoped.
 *
 * A provider id identifies a provider inside one scraper media registry and is
 * interpreted together with the profile or request entityType. Extension-backed
 * providers add the extension namespace here, but not the media type.
 */

export interface ExtensionScraperProviderIdParts {
  extensionId: string
  providerId: string
}

const EXTENSION_PROVIDER_PREFIX = 'ext:'

function requireProviderIdPart(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`${label} is required.`)
  }

  return normalized
}

function decodeProviderIdPart(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

export function createExtensionScraperProviderId(extensionId: string, providerId: string): string {
  const normalizedExtensionId = requireProviderIdPart(extensionId, 'Extension id')
  const normalizedProviderId = requireProviderIdPart(providerId, 'Provider id')

  return `${EXTENSION_PROVIDER_PREFIX}${encodeURIComponent(normalizedExtensionId)}/${encodeURIComponent(normalizedProviderId)}`
}

export function parseExtensionScraperProviderId(
  value: string
): ExtensionScraperProviderIdParts | null {
  if (!value.startsWith(EXTENSION_PROVIDER_PREFIX)) {
    return null
  }

  const segments = value.slice(EXTENSION_PROVIDER_PREFIX.length).split('/')
  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    return null
  }

  const extensionId = decodeProviderIdPart(segments[0])
  const providerId = decodeProviderIdPart(segments[1])
  if (!extensionId || !providerId) {
    return null
  }

  return { extensionId, providerId }
}
