import type {
  CharacterScraperProviderRegistration,
  CompanyScraperProviderRegistration,
  ExtensionRuntimeHandle,
  CharacterSessionResultMap as ExtensionCharacterSessionResultMap,
  CompanySessionResultMap as ExtensionCompanySessionResultMap,
  GameScraperProviderRegistration,
  GameSessionResultMap as ExtensionGameSessionResultMap,
  MainToHostRpcMethod,
  PersonScraperProviderRegistration,
  PersonSessionResultMap as ExtensionPersonSessionResultMap
} from '@kisaki/extension-api'
import log from 'electron-log/main'
import type { ScraperService } from '@main/services/scraper'
import type { ExtensionScraperProviderInfo } from '@shared/extension'
import type { Locale } from '@shared/locale'
import type { ScraperCapability, ScraperLookup } from '@shared/scraper'
import type {
  CharacterScraperProvider,
  CharacterSessionResultMap
} from '@main/services/scraper/handlers/character/provider'
import type {
  CompanyScraperProvider,
  CompanySessionResultMap
} from '@main/services/scraper/handlers/company/provider'
import type {
  GameScraperProvider,
  GameSessionResultMap
} from '@main/services/scraper/handlers/game/provider'
import type {
  PersonScraperProvider,
  PersonSessionResultMap
} from '@main/services/scraper/handlers/person/provider'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionHostOptions,
  type RuntimeContributionOwner
} from './types'

type ScraperKind = 'games' | 'persons' | 'companies' | 'characters'
type ScraperMediaType = 'game' | 'person' | 'company' | 'character'
type ScraperRpcAction = 'search' | 'resolve' | 'session.open' | 'session.get' | 'session.close'

type ScraperProviderRegistration =
  | GameScraperProviderRegistration
  | PersonScraperProviderRegistration
  | CompanyScraperProviderRegistration
  | CharacterScraperProviderRegistration

interface ScraperRegistration {
  owner: RuntimeContributionOwner
  mediaType: ScraperMediaType
  provider: ScraperProviderRegistration
  hostProviderId: string
}

interface ScraperDomain {
  kind: ScraperKind
  mediaType: ScraperMediaType
  registerWithScraper(scraper: ScraperService, provider: unknown): void
  unregisterFromScraper(scraper: ScraperService, hostProviderId: string): Promise<void>
  toSessionResults(results: unknown, registration: ScraperRegistration): unknown
}

interface ExternalIdRecord {
  source: string
  id: string
}

interface ValueWithExternalIds {
  externalIds: readonly ExternalIdRecord[]
}

export class ExtensionScraperContributionHost {
  private readonly registrations = new Map<string, ScraperRegistration>()
  private readonly domainsByMediaType: ReadonlyMap<ScraperMediaType, ScraperDomain>
  private readonly gameDomain: ScraperDomain = {
    kind: 'games',
    mediaType: 'game',
    registerWithScraper: (scraper, provider) =>
      scraper.registerGameProvider(provider as GameScraperProvider),
    unregisterFromScraper: (scraper, hostProviderId) =>
      scraper.unregisterGameProvider(hostProviderId),
    toSessionResults: (results, registration) =>
      toHostGameSessionResults(results as Partial<ExtensionGameSessionResultMap>, registration)
  }
  private readonly personDomain: ScraperDomain = {
    kind: 'persons',
    mediaType: 'person',
    registerWithScraper: (scraper, provider) =>
      scraper.registerPersonProvider(provider as PersonScraperProvider),
    unregisterFromScraper: (scraper, hostProviderId) =>
      scraper.unregisterPersonProvider(hostProviderId),
    toSessionResults: (results, registration) =>
      toHostPersonSessionResults(results as Partial<ExtensionPersonSessionResultMap>, registration)
  }
  private readonly companyDomain: ScraperDomain = {
    kind: 'companies',
    mediaType: 'company',
    registerWithScraper: (scraper, provider) =>
      scraper.registerCompanyProvider(provider as CompanyScraperProvider),
    unregisterFromScraper: (scraper, hostProviderId) =>
      scraper.unregisterCompanyProvider(hostProviderId),
    toSessionResults: (results, registration) =>
      toHostCompanySessionResults(
        results as Partial<ExtensionCompanySessionResultMap>,
        registration
      )
  }
  private readonly characterDomain: ScraperDomain = {
    kind: 'characters',
    mediaType: 'character',
    registerWithScraper: (scraper, provider) =>
      scraper.registerCharacterProvider(provider as CharacterScraperProvider),
    unregisterFromScraper: (scraper, hostProviderId) =>
      scraper.unregisterCharacterProvider(hostProviderId),
    toSessionResults: (results, registration) =>
      toHostCharacterSessionResults(
        results as Partial<ExtensionCharacterSessionResultMap>,
        registration
      )
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

function getScraperKey(
  runtimeHandle: ExtensionRuntimeHandle,
  mediaType: ScraperMediaType,
  providerId: string
): string {
  return `${getRuntimeContributionKey(runtimeHandle, providerId)}:${mediaType}`
}

function getHostScraperProviderId(extensionId: string, providerId: string): string {
  return `ext:${encodeURIComponent(extensionId)}/${encodeURIComponent(providerId)}`
}

function createProviderName(registration: ScraperRegistration): string {
  return `${registration.provider.name} (${registration.owner.extension.name})`
}

function createCapabilities(provider: ScraperProviderRegistration): ScraperCapability[] {
  return [...provider.capabilities] as ScraperCapability[]
}

function toExtensionLookup(
  lookup: ScraperLookup,
  registration: ScraperRegistration
): ScraperLookup {
  return {
    ...lookup,
    knownIds: lookup.knownIds?.map((externalId) => ({
      ...externalId,
      source:
        externalId.source === registration.hostProviderId
          ? registration.provider.id
          : externalId.source
    }))
  }
}

function toHostExternalIds<
  T extends {
    externalIds: readonly { source: string; id: string }[]
    relatedSites?: readonly { label: string; url: string }[]
  }
>(value: T, registration: ScraperRegistration): T {
  return {
    ...value,
    relatedSites: value.relatedSites ? [...value.relatedSites] : undefined,
    externalIds: value.externalIds.map((externalId) => ({
      ...externalId,
      source:
        externalId.source === registration.provider.id
          ? registration.hostProviderId
          : externalId.source
    }))
  }
}

function toHostSearchResult<T extends { externalIds: readonly { source: string; id: string }[] }>(
  value: T,
  registration: ScraperRegistration
): T {
  return toHostExternalIds(value, registration)
}

function createProviderAdapter(
  options: ExtensionContributionHostOptions,
  registration: ScraperRegistration,
  domain: ScraperDomain
): unknown {
  return {
    id: registration.hostProviderId,
    name: createProviderName(registration),
    capabilities: createCapabilities(registration.provider),
    async search(query: string, locale?: Locale) {
      const response = await requestScraperHost<{ results: readonly ValueWithExternalIds[] }>(
        options,
        domain,
        'search',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: registration.provider.id,
          query,
          locale
        },
        60_000
      )

      return response.results.map((result) => toHostSearchResult(result, registration))
    },
    async resolve(lookup: ScraperLookup, locale: Locale) {
      const response = await requestScraperHost<{ target: unknown }>(
        options,
        domain,
        'resolve',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: registration.provider.id,
          lookup: toExtensionLookup(lookup, registration),
          locale
        },
        60_000
      )

      return response.target
    },
    async openSession(target: unknown, locale: Locale) {
      const response = await requestScraperHost<{ sessionId: string }>(
        options,
        domain,
        'session.open',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: registration.provider.id,
          target,
          locale
        },
        60_000
      )

      return createSessionAdapter(options, registration, domain, response.sessionId)
    }
  }
}

function createSessionAdapter(
  options: ExtensionContributionHostOptions,
  registration: ScraperRegistration,
  domain: ScraperDomain,
  sessionId: string
): unknown {
  return {
    async get(slots: readonly string[]) {
      const response = await requestScraperHost<{ results: unknown }>(
        options,
        domain,
        'session.get',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: registration.provider.id,
          sessionId,
          slots
        },
        60_000
      )

      return domain.toSessionResults(response.results, registration)
    },
    async dispose() {
      await requestScraperHost<Record<string, never>>(
        options,
        domain,
        'session.close',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: registration.provider.id,
          sessionId
        },
        15_000
      )
    }
  }
}

async function requestScraperHost<TResponse>(
  options: ExtensionContributionHostOptions,
  domain: ScraperDomain,
  action: ScraperRpcAction,
  params: Record<string, unknown>,
  timeoutMs: number
): Promise<TResponse> {
  const response = await options.requestHost(getScraperRpcMethod(domain, action), params as never, {
    timeoutMs
  })

  return response as TResponse
}

function getScraperRpcMethod(domain: ScraperDomain, action: ScraperRpcAction): MainToHostRpcMethod {
  return `scrapers.${domain.kind}.${action}` as MainToHostRpcMethod
}

function toHostGameSessionResults(
  results: Partial<ExtensionGameSessionResultMap>,
  registration: ScraperRegistration
): Partial<GameSessionResultMap> {
  return {
    ...results,
    info: results.info
      ? (toHostExternalIds(results.info, registration) as GameSessionResultMap['info'])
      : undefined,
    characters: results.characters?.map(
      (item) => toHostExternalIds(item, registration) as GameSessionResultMap['characters'][number]
    ),
    persons: results.persons?.map(
      (item) => toHostExternalIds(item, registration) as GameSessionResultMap['persons'][number]
    ),
    companies: results.companies?.map(
      (item) => toHostExternalIds(item, registration) as GameSessionResultMap['companies'][number]
    ),
    tags: results.tags ? [...results.tags] : undefined,
    covers: results.covers ? [...results.covers] : undefined,
    backdrops: results.backdrops ? [...results.backdrops] : undefined,
    logos: results.logos ? [...results.logos] : undefined,
    icons: results.icons ? [...results.icons] : undefined
  }
}

function toHostPersonSessionResults(
  results: Partial<ExtensionPersonSessionResultMap>,
  registration: ScraperRegistration
): Partial<PersonSessionResultMap> {
  return {
    ...results,
    info: results.info
      ? (toHostExternalIds(results.info, registration) as PersonSessionResultMap['info'])
      : undefined,
    tags: results.tags ? [...results.tags] : undefined,
    photos: results.photos ? [...results.photos] : undefined
  }
}

function toHostCompanySessionResults(
  results: Partial<ExtensionCompanySessionResultMap>,
  registration: ScraperRegistration
): Partial<CompanySessionResultMap> {
  return {
    ...results,
    info: results.info
      ? (toHostExternalIds(results.info, registration) as CompanySessionResultMap['info'])
      : undefined,
    tags: results.tags ? [...results.tags] : undefined,
    logos: results.logos ? [...results.logos] : undefined
  }
}

function toHostCharacterSessionResults(
  results: Partial<ExtensionCharacterSessionResultMap>,
  registration: ScraperRegistration
): Partial<CharacterSessionResultMap> {
  return {
    ...results,
    info: results.info
      ? (toHostExternalIds(results.info, registration) as CharacterSessionResultMap['info'])
      : undefined,
    persons: results.persons?.map(
      (item) =>
        toHostExternalIds(item, registration) as CharacterSessionResultMap['persons'][number]
    ),
    tags: results.tags ? [...results.tags] : undefined,
    photos: results.photos ? [...results.photos] : undefined
  }
}
