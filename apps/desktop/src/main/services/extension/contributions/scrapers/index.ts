import type {
  CharacterScraperProviderRegistration,
  CompanyScraperProviderRegistration,
  ExtensionRuntimeHandle,
  GameScraperProviderRegistration,
  PersonScraperProviderRegistration
} from '@kisaki/extension-api'
import log from 'electron-log/main'
import type { ExtensionScraperProviderInfo } from '@shared/extension'
import type { CharacterScraperProvider } from '@main/services/scraper/handlers/character/provider'
import type { CompanyScraperProvider } from '@main/services/scraper/handlers/company/provider'
import type { GameScraperProvider } from '@main/services/scraper/handlers/game/provider'
import type { PersonScraperProvider } from '@main/services/scraper/handlers/person/provider'
import {
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionHostOptions
} from '../types'
import { getHostScraperProviderId, getScraperKey } from './descriptors'
import type {
  ScraperDomain,
  ScraperMediaType,
  ScraperProviderRegistration,
  ScraperRegistration
} from './domain'
import { createProviderAdapter } from './registrations'

export class ExtensionScraperContributionHost {
  private readonly registrations = new Map<string, ScraperRegistration>()
  private readonly domainsByMediaType: ReadonlyMap<ScraperMediaType, ScraperDomain>
  private readonly gameDomain: ScraperDomain = {
    kind: 'games',
    mediaType: 'game',
    registerWithScraper: (scraper, provider) =>
      scraper.registerGameProvider(provider as GameScraperProvider),
    unregisterFromScraper: (scraper, hostProviderId) =>
      scraper.unregisterGameProvider(hostProviderId)
  }
  private readonly personDomain: ScraperDomain = {
    kind: 'persons',
    mediaType: 'person',
    registerWithScraper: (scraper, provider) =>
      scraper.registerPersonProvider(provider as PersonScraperProvider),
    unregisterFromScraper: (scraper, hostProviderId) =>
      scraper.unregisterPersonProvider(hostProviderId)
  }
  private readonly companyDomain: ScraperDomain = {
    kind: 'companies',
    mediaType: 'company',
    registerWithScraper: (scraper, provider) =>
      scraper.registerCompanyProvider(provider as CompanyScraperProvider),
    unregisterFromScraper: (scraper, hostProviderId) =>
      scraper.unregisterCompanyProvider(hostProviderId)
  }
  private readonly characterDomain: ScraperDomain = {
    kind: 'characters',
    mediaType: 'character',
    registerWithScraper: (scraper, provider) =>
      scraper.registerCharacterProvider(provider as CharacterScraperProvider),
    unregisterFromScraper: (scraper, hostProviderId) =>
      scraper.unregisterCharacterProvider(hostProviderId)
  }

  constructor(private readonly options: ExtensionContributionHostOptions) {
    this.domainsByMediaType = new Map<ScraperMediaType, ScraperDomain>([
      [this.gameDomain.mediaType, this.gameDomain],
      [this.personDomain.mediaType, this.personDomain],
      [this.companyDomain.mediaType, this.companyDomain],
      [this.characterDomain.mediaType, this.characterDomain]
    ])
  }

  registerGameProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    provider: GameScraperProviderRegistration
  ): Promise<void> {
    return this.register(runtimeHandle, provider, this.gameDomain)
  }

  unregisterGameProvider(runtimeHandle: ExtensionRuntimeHandle, providerId: string): Promise<void> {
    return this.unregister(runtimeHandle, providerId, this.gameDomain)
  }

  registerPersonProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    provider: PersonScraperProviderRegistration
  ): Promise<void> {
    return this.register(runtimeHandle, provider, this.personDomain)
  }

  unregisterPersonProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    providerId: string
  ): Promise<void> {
    return this.unregister(runtimeHandle, providerId, this.personDomain)
  }

  registerCompanyProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    provider: CompanyScraperProviderRegistration
  ): Promise<void> {
    return this.register(runtimeHandle, provider, this.companyDomain)
  }

  unregisterCompanyProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    providerId: string
  ): Promise<void> {
    return this.unregister(runtimeHandle, providerId, this.companyDomain)
  }

  registerCharacterProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    provider: CharacterScraperProviderRegistration
  ): Promise<void> {
    return this.register(runtimeHandle, provider, this.characterDomain)
  }

  unregisterCharacterProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    providerId: string
  ): Promise<void> {
    return this.unregister(runtimeHandle, providerId, this.characterDomain)
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

  getSnapshot(): readonly ExtensionScraperProviderInfo[] {
    return [...this.registrations.values()]
      .map((registration) => ({
        ...toContributionOwnerInfo(registration.owner),
        mediaType: registration.mediaType,
        provider: registration.provider
      }))
      .sort(
        (left, right) =>
          left.mediaType.localeCompare(right.mediaType) ||
          left.provider.id.localeCompare(right.provider.id)
      )
  }

  private async register(
    runtimeHandle: ExtensionRuntimeHandle,
    provider: ScraperProviderRegistration,
    domain: ScraperDomain
  ): Promise<void> {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    const registration: ScraperRegistration = {
      owner,
      mediaType: domain.mediaType,
      provider,
      hostProviderId: getHostScraperProviderId(owner.extension.id, provider.id)
    }
    const key = getScraperKey(runtimeHandle, domain.mediaType, provider.id)
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
    const key = getScraperKey(runtimeHandle, domain.mediaType, providerId)
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
    const scraper = this.options.scraper
    if (!scraper) {
      return
    }

    domain.registerWithScraper(scraper, createProviderAdapter(this.options, registration, domain))
  }

  private async unregisterProviderFromScraperService(
    registration: ScraperRegistration
  ): Promise<void> {
    const scraper = this.options.scraper
    if (!scraper) {
      return
    }

    try {
      await this.requireDomain(registration.mediaType).unregisterFromScraper(
        scraper,
        registration.hostProviderId
      )
    } catch (error) {
      log.warn(
        `[ExtensionScraperContributionHost] Failed to unregister provider "${registration.hostProviderId}":`,
        error
      )
    }
  }

  private requireDomain(mediaType: ScraperMediaType): ScraperDomain {
    const domain = this.domainsByMediaType.get(mediaType)
    if (!domain) {
      throw new Error(`Unknown scraper media type "${mediaType}".`)
    }

    return domain
  }
}
