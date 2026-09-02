import type { ExtensionRuntimeHandle } from '@kisaki3/extension-api'
import type { ContentEntityType } from '@shared/entity-types'
import { createLogger } from '@main/log'
import type { ExtensionScraperProviderRegistrationInfo } from '@shared/extension'
import { createExtensionScraperProviderId } from '@shared/scraper'
import type {
  AnimeScraperProvider,
  CharacterScraperProvider,
  ComicScraperProvider,
  CompanyScraperProvider,
  GameScraperProvider,
  NovelScraperProvider,
  PersonScraperProvider,
  ScraperService
} from '@main/services/scraper'
import {
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionReleaseDiagnostic,
  type ExtensionContributionPointOptions
} from '../types'
import { getScraperKey } from './descriptors'
import type { ScraperDomain, ScraperProviderRegistration, ScraperRegistration } from './domain'
import { createProviderAdapter } from './registrations'

export interface ExtensionScraperProviderContributionPointOptions extends ExtensionContributionPointOptions {
  scraper: ScraperService
}

const log = createLogger('Extension')

/** Keyed by the closed media-type union so adding a media type fails compilation here. */
const SCRAPER_DOMAINS = {
  game: {
    kind: 'games',
    entityType: 'game',
    registerWithScraper: (scraper, provider) =>
      scraper.game.registerProvider(provider as GameScraperProvider),
    unregisterFromScraper: (scraper, registryProviderId) =>
      scraper.game.unregisterProvider(registryProviderId)
  },
  anime: {
    kind: 'animes',
    entityType: 'anime',
    registerWithScraper: (scraper, provider) =>
      scraper.anime.registerProvider(provider as AnimeScraperProvider),
    unregisterFromScraper: (scraper, registryProviderId) =>
      scraper.anime.unregisterProvider(registryProviderId)
  },
  comic: {
    kind: 'comics',
    entityType: 'comic',
    registerWithScraper: (scraper, provider) =>
      scraper.comic.registerProvider(provider as ComicScraperProvider),
    unregisterFromScraper: (scraper, registryProviderId) =>
      scraper.comic.unregisterProvider(registryProviderId)
  },
  novel: {
    kind: 'novels',
    entityType: 'novel',
    registerWithScraper: (scraper, provider) =>
      scraper.novel.registerProvider(provider as NovelScraperProvider),
    unregisterFromScraper: (scraper, registryProviderId) =>
      scraper.novel.unregisterProvider(registryProviderId)
  },
  person: {
    kind: 'persons',
    entityType: 'person',
    registerWithScraper: (scraper, provider) =>
      scraper.person.registerProvider(provider as PersonScraperProvider),
    unregisterFromScraper: (scraper, registryProviderId) =>
      scraper.person.unregisterProvider(registryProviderId)
  },
  company: {
    kind: 'companies',
    entityType: 'company',
    registerWithScraper: (scraper, provider) =>
      scraper.company.registerProvider(provider as CompanyScraperProvider),
    unregisterFromScraper: (scraper, registryProviderId) =>
      scraper.company.unregisterProvider(registryProviderId)
  },
  character: {
    kind: 'characters',
    entityType: 'character',
    registerWithScraper: (scraper, provider) =>
      scraper.character.registerProvider(provider as CharacterScraperProvider),
    unregisterFromScraper: (scraper, registryProviderId) =>
      scraper.character.unregisterProvider(registryProviderId)
  }
} satisfies Record<ContentEntityType, ScraperDomain>

export class ExtensionScraperProviderContributionPoint {
  private readonly registrations = new Map<string, ScraperRegistration>()

  constructor(private readonly options: ExtensionScraperProviderContributionPointOptions) {}

  registerProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    entityType: ContentEntityType,
    provider: ScraperProviderRegistration
  ): Promise<void> {
    return this.register(runtimeHandle, provider, this.requireDomain(entityType))
  }

  unregisterProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    entityType: ContentEntityType,
    providerId: string
  ): Promise<void> {
    return this.unregister(runtimeHandle, providerId, this.requireDomain(entityType))
  }

  async releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): Promise<void> {
    const released: ScraperRegistration[] = []

    for (const [key, registration] of [...this.registrations]) {
      if (registration.owner.runtimeHandle === runtimeHandle) {
        this.registrations.delete(key)
        released.push(registration)
      }
    }

    await Promise.all(
      released.map((registration) => this.unregisterProviderFromScraperService(registration))
    )
  }

  async releaseAll(): Promise<void> {
    const released = [...this.registrations.values()]
    this.registrations.clear()

    await Promise.all(
      released.map((registration) => this.unregisterProviderFromScraperService(registration))
    )
  }

  getSnapshot(): readonly ExtensionScraperProviderRegistrationInfo[] {
    return [...this.registrations.values()]
      .map((registration) => ({
        ...toContributionOwnerInfo(registration.owner),
        entityType: registration.entityType,
        provider: registration.provider
      }))
      .sort(
        (left, right) =>
          left.entityType.localeCompare(right.entityType) ||
          left.provider.id.localeCompare(right.provider.id)
      )
  }

  getReleaseDiagnostics(extensionId: string): readonly ExtensionContributionReleaseDiagnostic[] {
    return [...this.registrations.values()]
      .filter((registration) => registration.owner.extension.id === extensionId)
      .map((registration) => ({
        domain: 'scraper providers',
        detail: `${registration.entityType}:${registration.provider.id}`
      }))
  }

  private async register(
    runtimeHandle: ExtensionRuntimeHandle,
    provider: ScraperProviderRegistration,
    domain: ScraperDomain
  ): Promise<void> {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    const registration: ScraperRegistration = {
      owner,
      entityType: domain.entityType,
      provider,
      registryProviderId: createExtensionScraperProviderId(owner.extension.id, provider.id)
    }
    const key = getScraperKey(runtimeHandle, domain.entityType, provider.id)
    const previous = this.registrations.get(key)
    if (previous) {
      this.registrations.delete(key)
      await this.unregisterProviderFromScraperService(previous)
    }

    this.registerProviderWithScraperService(registration, domain)
    this.registrations.set(key, registration)
  }

  private async unregister(
    runtimeHandle: ExtensionRuntimeHandle,
    providerId: string,
    domain: ScraperDomain
  ): Promise<void> {
    const key = getScraperKey(runtimeHandle, domain.entityType, providerId)
    const registration = this.registrations.get(key)
    if (!registration) {
      return
    }

    this.registrations.delete(key)
    await this.unregisterProviderFromScraperService(registration)
  }

  private registerProviderWithScraperService(
    registration: ScraperRegistration,
    domain: ScraperDomain
  ): void {
    domain.registerWithScraper(
      this.options.scraper,
      createProviderAdapter(this.options, registration, domain)
    )
  }

  private async unregisterProviderFromScraperService(
    registration: ScraperRegistration
  ): Promise<void> {
    try {
      await this.requireDomain(registration.entityType).unregisterFromScraper(
        this.options.scraper,
        registration.registryProviderId
      )
    } catch (error) {
      log.warn('Failed to unregister provider.', error, {
        registryProviderId: registration.registryProviderId
      })
    }
  }

  private requireDomain(entityType: ContentEntityType): ScraperDomain {
    // The media type crosses the RPC boundary, so genuinely unknown strings
    // can still arrive at runtime despite the compile-time union.
    const domain: ScraperDomain | undefined = SCRAPER_DOMAINS[entityType]
    if (!domain) {
      throw new Error(`Unknown scraper media type "${entityType}".`)
    }

    return domain
  }
}
