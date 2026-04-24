import type {
  CharacterScraperProviderRegistration,
  CharacterScraperSlot as ExtensionCharacterScraperSlot,
  CompanyScraperProviderRegistration,
  CompanyScraperSlot as ExtensionCompanyScraperSlot,
  ExtensionRuntimeHandle,
  GameSessionResultMap as ExtensionGameSessionResultMap,
  GameScraperProviderRegistration,
  GameScraperSlot as ExtensionGameScraperSlot,
  PersonScraperProviderRegistration,
  PersonSessionResultMap as ExtensionPersonSessionResultMap,
  CompanySessionResultMap as ExtensionCompanySessionResultMap,
  CharacterSessionResultMap as ExtensionCharacterSessionResultMap,
  PersonScraperSlot as ExtensionPersonScraperSlot
} from '@kisaki/extension-api'
import log from 'electron-log/main'
import type { ExtensionScraperProviderInfo } from '@shared/extension'
import type {
  CharacterSearchResult,
  CompanySearchResult,
  GameSearchResult,
  PersonSearchResult,
  ScraperCapability,
  ScraperLookup
} from '@shared/scraper'
import type {
  CharacterResolvedTarget,
  CharacterScraperProvider,
  CharacterScraperSession,
  CharacterSessionResultMap
} from '@main/services/scraper/handlers/character/provider'
import type {
  CompanyResolvedTarget,
  CompanyScraperProvider,
  CompanyScraperSession,
  CompanySessionResultMap
} from '@main/services/scraper/handlers/company/provider'
import type {
  GameResolvedTarget,
  GameScraperProvider,
  GameScraperSession,
  GameSessionResultMap
} from '@main/services/scraper/handlers/game/provider'
import type {
  PersonResolvedTarget,
  PersonScraperProvider,
  PersonScraperSession,
  PersonSessionResultMap
} from '@main/services/scraper/handlers/person/provider'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionHostOptions,
  type RuntimeContributionOwner
} from './types'

type ScraperMediaType = 'game' | 'person' | 'company' | 'character'

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

export class ExtensionScraperContributionHost {
  private readonly registrations = new Map<string, ScraperRegistration>()

  constructor(private readonly options: ExtensionContributionHostOptions) {}

  registerGameProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    provider: GameScraperProviderRegistration
  ): Promise<void> {
    return this.register(runtimeHandle, 'game', provider)
  }

  unregisterGameProvider(runtimeHandle: ExtensionRuntimeHandle, providerId: string): Promise<void> {
    return this.unregister(runtimeHandle, 'game', providerId)
  }

  registerPersonProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    provider: PersonScraperProviderRegistration
  ): Promise<void> {
    return this.register(runtimeHandle, 'person', provider)
  }

  unregisterPersonProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    providerId: string
  ): Promise<void> {
    return this.unregister(runtimeHandle, 'person', providerId)
  }

  registerCompanyProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    provider: CompanyScraperProviderRegistration
  ): Promise<void> {
    return this.register(runtimeHandle, 'company', provider)
  }

  unregisterCompanyProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    providerId: string
  ): Promise<void> {
    return this.unregister(runtimeHandle, 'company', providerId)
  }

  registerCharacterProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    provider: CharacterScraperProviderRegistration
  ): Promise<void> {
    return this.register(runtimeHandle, 'character', provider)
  }

  unregisterCharacterProvider(
    runtimeHandle: ExtensionRuntimeHandle,
    providerId: string
  ): Promise<void> {
    return this.unregister(runtimeHandle, 'character', providerId)
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
    mediaType: ScraperMediaType,
    provider: ScraperProviderRegistration
  ): Promise<void> {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    const registration: ScraperRegistration = {
      owner,
      mediaType,
      provider,
      hostProviderId: getHostScraperProviderId(owner.extension.id, provider.id)
    }
    const key = getScraperKey(runtimeHandle, mediaType, provider.id)
    const previous = this.registrations.get(key)
    if (previous) {
      this.registrations.delete(key)
      await this.unregisterProviderFromScraperService(previous)
    }

    this.registerProviderWithScraperService(registration)
    this.registrations.set(key, registration)
  }

  private async unregister(
    runtimeHandle: ExtensionRuntimeHandle,
    mediaType: ScraperMediaType,
    providerId: string
  ): Promise<void> {
    const key = getScraperKey(runtimeHandle, mediaType, providerId)
    const registration = this.registrations.get(key)
    if (!registration) {
      return
    }

    this.registrations.delete(key)
    await this.unregisterProviderFromScraperService(registration)
  }

  private registerProviderWithScraperService(registration: ScraperRegistration): void {
    const scraper = this.options.scraper
    if (!scraper) {
      return
    }

    switch (registration.mediaType) {
      case 'game':
        scraper.registerGameProvider(createGameProviderAdapter(this.options, registration))
        return
      case 'person':
        scraper.registerPersonProvider(createPersonProviderAdapter(this.options, registration))
        return
      case 'company':
        scraper.registerCompanyProvider(createCompanyProviderAdapter(this.options, registration))
        return
      case 'character':
        scraper.registerCharacterProvider(
          createCharacterProviderAdapter(this.options, registration)
        )
        return
    }
  }

  private async unregisterProviderFromScraperService(
    registration: ScraperRegistration
  ): Promise<void> {
    const scraper = this.options.scraper
    if (!scraper) {
      return
    }

    try {
      switch (registration.mediaType) {
        case 'game':
          await scraper.unregisterGameProvider(registration.hostProviderId)
          return
        case 'person':
          await scraper.unregisterPersonProvider(registration.hostProviderId)
          return
        case 'company':
          await scraper.unregisterCompanyProvider(registration.hostProviderId)
          return
        case 'character':
          await scraper.unregisterCharacterProvider(registration.hostProviderId)
          return
      }
    } catch (error) {
      log.warn(
        `[ExtensionScraperContributionHost] Failed to unregister provider "${registration.hostProviderId}":`,
        error
      )
    }
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

function createGameProviderAdapter(
  options: ExtensionContributionHostOptions,
  registration: ScraperRegistration
): GameScraperProvider {
  const provider = registration.provider as GameScraperProviderRegistration

  return {
    id: registration.hostProviderId,
    name: createProviderName(registration),
    capabilities: createCapabilities(provider),
    async search(query, locale) {
      const response = await options.requestHost(
        'scrapers.games.search',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          query,
          locale
        },
        { timeoutMs: 60_000 }
      )

      return response.results.map((result) =>
        toHostSearchResult(result, registration)
      ) as GameSearchResult[]
    },
    async resolve(lookup, locale) {
      const response = await options.requestHost(
        'scrapers.games.resolve',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          lookup: toExtensionLookup(lookup, registration),
          locale
        },
        { timeoutMs: 60_000 }
      )

      return response.target as GameResolvedTarget | null
    },
    async openSession(target, locale) {
      const response = await options.requestHost(
        'scrapers.games.session.open',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          target,
          locale
        },
        { timeoutMs: 60_000 }
      )

      return createGameSessionAdapter(options, registration, response.sessionId)
    }
  }
}

function createGameSessionAdapter(
  options: ExtensionContributionHostOptions,
  registration: ScraperRegistration,
  sessionId: string
): GameScraperSession {
  const provider = registration.provider as GameScraperProviderRegistration

  return {
    async get(slots) {
      const response = await options.requestHost(
        'scrapers.games.session.get',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          sessionId,
          slots: slots as readonly ExtensionGameScraperSlot[]
        },
        { timeoutMs: 60_000 }
      )

      return toHostGameSessionResults(response.results, registration)
    },
    async dispose() {
      await options.requestHost(
        'scrapers.games.session.close',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          sessionId
        },
        { timeoutMs: 15_000 }
      )
    }
  }
}

function createPersonProviderAdapter(
  options: ExtensionContributionHostOptions,
  registration: ScraperRegistration
): PersonScraperProvider {
  const provider = registration.provider as PersonScraperProviderRegistration

  return {
    id: registration.hostProviderId,
    name: createProviderName(registration),
    capabilities: createCapabilities(provider),
    async search(query, locale) {
      const response = await options.requestHost(
        'scrapers.persons.search',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          query,
          locale
        },
        { timeoutMs: 60_000 }
      )

      return response.results.map((result) =>
        toHostSearchResult(result, registration)
      ) as PersonSearchResult[]
    },
    async resolve(lookup, locale) {
      const response = await options.requestHost(
        'scrapers.persons.resolve',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          lookup: toExtensionLookup(lookup, registration),
          locale
        },
        { timeoutMs: 60_000 }
      )

      return response.target as PersonResolvedTarget | null
    },
    async openSession(target, locale) {
      const response = await options.requestHost(
        'scrapers.persons.session.open',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          target,
          locale
        },
        { timeoutMs: 60_000 }
      )

      return createPersonSessionAdapter(options, registration, response.sessionId)
    }
  }
}

function createPersonSessionAdapter(
  options: ExtensionContributionHostOptions,
  registration: ScraperRegistration,
  sessionId: string
): PersonScraperSession {
  const provider = registration.provider as PersonScraperProviderRegistration

  return {
    async get(slots) {
      const response = await options.requestHost(
        'scrapers.persons.session.get',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          sessionId,
          slots: slots as readonly ExtensionPersonScraperSlot[]
        },
        { timeoutMs: 60_000 }
      )

      return toHostPersonSessionResults(response.results, registration)
    },
    async dispose() {
      await options.requestHost(
        'scrapers.persons.session.close',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          sessionId
        },
        { timeoutMs: 15_000 }
      )
    }
  }
}

function createCompanyProviderAdapter(
  options: ExtensionContributionHostOptions,
  registration: ScraperRegistration
): CompanyScraperProvider {
  const provider = registration.provider as CompanyScraperProviderRegistration

  return {
    id: registration.hostProviderId,
    name: createProviderName(registration),
    capabilities: createCapabilities(provider),
    async search(query, locale) {
      const response = await options.requestHost(
        'scrapers.companies.search',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          query,
          locale
        },
        { timeoutMs: 60_000 }
      )

      return response.results.map((result) =>
        toHostSearchResult(result, registration)
      ) as CompanySearchResult[]
    },
    async resolve(lookup, locale) {
      const response = await options.requestHost(
        'scrapers.companies.resolve',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          lookup: toExtensionLookup(lookup, registration),
          locale
        },
        { timeoutMs: 60_000 }
      )

      return response.target as CompanyResolvedTarget | null
    },
    async openSession(target, locale) {
      const response = await options.requestHost(
        'scrapers.companies.session.open',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          target,
          locale
        },
        { timeoutMs: 60_000 }
      )

      return createCompanySessionAdapter(options, registration, response.sessionId)
    }
  }
}

function createCompanySessionAdapter(
  options: ExtensionContributionHostOptions,
  registration: ScraperRegistration,
  sessionId: string
): CompanyScraperSession {
  const provider = registration.provider as CompanyScraperProviderRegistration

  return {
    async get(slots) {
      const response = await options.requestHost(
        'scrapers.companies.session.get',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          sessionId,
          slots: slots as readonly ExtensionCompanyScraperSlot[]
        },
        { timeoutMs: 60_000 }
      )

      return toHostCompanySessionResults(response.results, registration)
    },
    async dispose() {
      await options.requestHost(
        'scrapers.companies.session.close',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          sessionId
        },
        { timeoutMs: 15_000 }
      )
    }
  }
}

function createCharacterProviderAdapter(
  options: ExtensionContributionHostOptions,
  registration: ScraperRegistration
): CharacterScraperProvider {
  const provider = registration.provider as CharacterScraperProviderRegistration

  return {
    id: registration.hostProviderId,
    name: createProviderName(registration),
    capabilities: createCapabilities(provider),
    async search(query, locale) {
      const response = await options.requestHost(
        'scrapers.characters.search',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          query,
          locale
        },
        { timeoutMs: 60_000 }
      )

      return response.results.map((result) =>
        toHostSearchResult(result, registration)
      ) as CharacterSearchResult[]
    },
    async resolve(lookup, locale) {
      const response = await options.requestHost(
        'scrapers.characters.resolve',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          lookup: toExtensionLookup(lookup, registration),
          locale
        },
        { timeoutMs: 60_000 }
      )

      return response.target as CharacterResolvedTarget | null
    },
    async openSession(target, locale) {
      const response = await options.requestHost(
        'scrapers.characters.session.open',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          target,
          locale
        },
        { timeoutMs: 60_000 }
      )

      return createCharacterSessionAdapter(options, registration, response.sessionId)
    }
  }
}

function createCharacterSessionAdapter(
  options: ExtensionContributionHostOptions,
  registration: ScraperRegistration,
  sessionId: string
): CharacterScraperSession {
  const provider = registration.provider as CharacterScraperProviderRegistration

  return {
    async get(slots) {
      const response = await options.requestHost(
        'scrapers.characters.session.get',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          sessionId,
          slots: slots as readonly ExtensionCharacterScraperSlot[]
        },
        { timeoutMs: 60_000 }
      )

      return toHostCharacterSessionResults(response.results, registration)
    },
    async dispose() {
      await options.requestHost(
        'scrapers.characters.session.close',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: provider.id,
          sessionId
        },
        { timeoutMs: 15_000 }
      )
    }
  }
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
