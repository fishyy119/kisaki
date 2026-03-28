/**
 * Provider registry and contract validation for scraper handlers.
 */

import type { ScraperCapability } from '@shared/scraper'

export interface RegisteredScraperProvider {
  readonly id: string
  readonly name: string
  readonly capabilities: readonly ScraperCapability[]
}

export interface ScraperProviderRegistry<TProvider extends RegisteredScraperProvider> {
  register(provider: TProvider): void
  delete(providerId: string): boolean
  get(providerId: string): TProvider | undefined
  has(providerId: string): boolean
  list(): readonly TProvider[]
  asMap(): ReadonlyMap<string, TProvider>
}

function hasMethod(provider: RegisteredScraperProvider, methodName: string): boolean {
  return typeof (provider as unknown as Record<string, unknown>)[methodName] === 'function'
}

/**
 * Validate a provider's static contract before it enters a registry.
 */
export function assertProviderContract<TProvider extends RegisteredScraperProvider>(
  provider: TProvider,
  allowedCapabilities: ReadonlySet<ScraperCapability>
): void {
  if (typeof provider.id !== 'string' || !provider.id.trim()) {
    throw new Error('[Scraper] Provider id is required')
  }

  if (typeof provider.name !== 'string' || !provider.name.trim()) {
    throw new Error(`[Scraper] Provider name is required (${provider.id})`)
  }

  if (!Array.isArray(provider.capabilities) || provider.capabilities.length === 0) {
    throw new Error(`[Scraper] Provider '${provider.id}' capabilities must be a non-empty array`)
  }

  const declared = new Set<ScraperCapability>()
  for (const capability of provider.capabilities) {
    if (!allowedCapabilities.has(capability)) {
      throw new Error(
        `[Scraper] Provider '${provider.id}' declares invalid capability: ${capability}`
      )
    }

    if (declared.has(capability)) {
      throw new Error(
        `[Scraper] Provider '${provider.id}' declares duplicate capability: ${capability}`
      )
    }

    declared.add(capability)
  }

  if (!declared.has('search')) {
    throw new Error(`[Scraper] Provider '${provider.id}' must declare 'search' capability`)
  }

  for (const methodName of ['search', 'resolve', 'openSession']) {
    if (!hasMethod(provider, methodName)) {
      throw new Error(
        `[Scraper] Provider '${provider.id}' must implement '${methodName}' for the session-based runtime`
      )
    }
  }
}

/**
 * Create a typed provider registry for one scraper media domain.
 */
export function createProviderRegistry<TProvider extends RegisteredScraperProvider>(
  allowedCapabilities: ReadonlySet<ScraperCapability>
): ScraperProviderRegistry<TProvider> {
  const providers = new Map<string, TProvider>()

  return {
    register(provider) {
      assertProviderContract(provider, allowedCapabilities)

      const existing = providers.get(provider.id)
      if (existing) {
        throw new Error(
          `[Scraper] Provider '${provider.id}' is already registered by '${existing.name}'`
        )
      }

      providers.set(provider.id, provider)
    },

    delete(providerId) {
      return providers.delete(providerId)
    },

    get(providerId) {
      return providers.get(providerId)
    },

    has(providerId) {
      return providers.has(providerId)
    },

    list() {
      return Array.from(providers.values())
    },

    asMap() {
      return providers
    }
  }
}

/**
 * Read a provider from a registry-like map.
 */
export function getProvider<TProvider extends RegisteredScraperProvider>(
  providers: ReadonlyMap<string, TProvider>,
  providerId: string
): TProvider | undefined {
  return providers.get(providerId)
}

/**
 * Check whether a provider exists in a registry-like map.
 */
export function hasRegisteredProvider<TProvider extends RegisteredScraperProvider>(
  providers: ReadonlyMap<string, TProvider>,
  providerId: string
): boolean {
  return providers.has(providerId)
}

/**
 * Return provider infos from a registry-like map.
 */
export function listProviders<TProvider extends RegisteredScraperProvider>(
  providers: ReadonlyMap<string, TProvider>
): readonly TProvider[] {
  return Array.from(providers.values())
}
