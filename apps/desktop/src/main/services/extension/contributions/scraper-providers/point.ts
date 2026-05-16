import type { ExtensionRuntimeHandle } from '@kisaki/extension-api'
import { createLogger } from '@main/log'
import type { ExtensionScraperProviderRegistrationInfo } from '@shared/extension'
import type {
  CharacterScraperProvider,
  CompanyScraperProvider,
  GameScraperProvider,
  PersonScraperProvider
} from '@main/services/scraper'
import {
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionReleaseDiagnostic,
  type ExtensionContributionDomainOptions
} from '../types'
import { getHostScraperProviderId, getScraperKey } from './descriptors'
import type {
  ScraperDomain,
  ScraperMediaType,
  ScraperProviderRegistration,
  ScraperRegistration
} from './domain'
import { createProviderAdapter } from './registrations'

const log = createLogger('Extension')

export class ExtensionScraperProviderContributionPoint {
  private readonly registrations = new Map<string, ScraperRegistration>()
  private readonly domainsByMediaType: ReadonlyMap<ScraperMediaType, ScraperDomain>
  private readonly gameDomain: ScraperDomain = {
    kind: 'games',
    mediaType: 'game',
    registerWithScraper: (scraper, provider) =>
      scraper.game.registerProvider(provider as GameScraperProvider),
    unregisterFromScraper: (scraper, hostProviderId) =>
      scraper.game.unregisterProvider(hostProviderId)
  }
  private readonly personDomain: ScraperDomain = {
    kind: 'persons',
    mediaType: 'person',
    registerWithScraper: (scraper, provider) =>
      scraper.person.registerProvider(provider as PersonScraperProvider),
    unregisterFromScraper: (scraper, hostProviderId) =>
      scraper.person.unregisterProvider(hostProviderId)
  }
  private readonly companyDomain: ScraperDomain = {
    kind: 'companies',
    mediaType: 'company',
    registerWithScraper: (scraper, provider) =>
      scraper.company.registerProvider(provider as CompanyScraperProvider),
    unregisterFromScraper: (scraper, hostProviderId) =>
      scraper.company.unregisterProvider(hostProviderId)
  }
  private readonly characterDomain: ScraperDomain = {
    kind: 'characters',
    mediaType: 'character',
    registerWithScraper: (scraper, provider) =>
      scraper.character.registerProvider(provider as CharacterScraperProvider),
    unregisterFromScraper: (scraper, hostProviderId) =>
      scraper.character.unregisterProvider(hostProviderId)
  }

  constructor(private readonly options: ExtensionContributionDomainOptions) {
    this.domainsByMediaType = new Map<ScraperMediaType, ScraperDomain>([
      [this.gameDomain.mediaType, this.gameDomain],
      [this.personDomain.mediaType, this.personDomain],
      [this.companyDomain.mediaType, this.companyDomain],
      [this.characterDomain.mediaType, this.characterDomain]
    ])
  }

  registerProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    mediaType: ScraperMediaType,
    provider: ScraperProviderRegistration
  ): Promise<void> {
    return this.register(runtimeHandle, provider, this.requireDomain(mediaType))
  }

  unregisterProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    mediaType: ScraperMediaType,
    providerId: string
  ): Promise<void> {
    return this.unregister(runtimeHandle, providerId, this.requireDomain(mediaType))
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
        mediaType: registration.mediaType,
        provider: registration.provider
      }))
      .sort(
        (left, right) =>
          left.mediaType.localeCompare(right.mediaType) ||
          left.provider.id.localeCompare(right.provider.id)
      )
  }

  getReleaseDiagnostics(extensionId: string): readonly ExtensionContributionReleaseDiagnostic[] {
    return [...this.registrations.values()]
      .filter((registration) => registration.owner.extension.id === extensionId)
      .map((registration) => ({
        domain: 'scraper providers',
        detail: `${registration.mediaType}:${registration.provider.id}`
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
      mediaType: domain.mediaType,
      provider,
      hostProviderId: getHostScraperProviderId(owner.extension.id, domain.mediaType, provider.id)
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
      log.warn('Failed to unregister provider.', error, {
        registrationHostProviderId: registration.hostProviderId
      })
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
