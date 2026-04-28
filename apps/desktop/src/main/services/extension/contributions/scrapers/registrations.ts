import type { Locale } from '@shared/locale'
import type { ScraperLookup } from '@shared/scraper'
import type { ExtensionContributionHostOptions } from '../types'
import { getScraperRpcMethod } from './descriptors'
import type { ScraperDomain, ScraperRegistration } from './domain'

export function createProviderAdapter(
  options: ExtensionContributionHostOptions,
  registration: ScraperRegistration,
  domain: ScraperDomain
): unknown {
  return {
    id: registration.hostProviderId,
    name: registration.provider.name,
    externalIdSource: registration.provider.externalIdSource,
    capabilities: [...registration.provider.capabilities],
    async search(query: string, locale?: Locale) {
      const response = await requestScraperHost<{ results: readonly unknown[] }>(
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

      return response.results
    },
    async resolve(lookup: ScraperLookup, locale: Locale) {
      const response = await requestScraperHost<{ target: unknown }>(
        options,
        domain,
        'resolve',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          providerId: registration.provider.id,
          lookup,
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

      return response.results
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
