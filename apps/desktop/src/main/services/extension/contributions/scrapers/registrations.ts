import type {
  CharacterSessionResultMap as ExtensionCharacterSessionResultMap,
  CompanySessionResultMap as ExtensionCompanySessionResultMap,
  GameSessionResultMap as ExtensionGameSessionResultMap,
  PersonSessionResultMap as ExtensionPersonSessionResultMap
} from '@kisaki/extension-api'
import type { Locale } from '@shared/locale'
import type { ScraperCapability, ScraperLookup } from '@shared/scraper'
import type { CharacterSessionResultMap } from '@main/services/scraper/handlers/character/provider'
import type { CompanySessionResultMap } from '@main/services/scraper/handlers/company/provider'
import type { GameSessionResultMap } from '@main/services/scraper/handlers/game/provider'
import type { PersonSessionResultMap } from '@main/services/scraper/handlers/person/provider'
import type { ExtensionContributionHostOptions } from '../types'
import { getScraperRpcMethod } from './descriptors'
import type {
  ScraperDomain,
  ScraperProviderRegistration,
  ScraperRegistration,
  ValueWithExternalIds
} from './domain'

export function createProviderAdapter(
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

export function toHostGameSessionResults(
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

export function toHostPersonSessionResults(
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

export function toHostCompanySessionResults(
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

export function toHostCharacterSessionResults(
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
  action: 'search' | 'resolve' | 'session.open' | 'session.get' | 'session.close',
  params: Record<string, unknown>,
  timeoutMs: number
): Promise<TResponse> {
  const response = await options.requestHost(getScraperRpcMethod(domain, action), params as never, {
    timeoutMs
  })

  return response as TResponse
}
