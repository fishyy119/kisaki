import type { Locale } from '@shared/locale'
import type { ScraperLookup } from '@shared/scraper'
import type { ExtensionContributionDomainOptions } from '../types'
import { EXTENSION_CLEANUP_TIMEOUT_MS } from '../../shared/rpc-timeouts'
import { getScraperRpcMethod } from './descriptors'
import type { ScraperDomain, ScraperRegistration } from './domain'

export function createProviderAdapter(
  options: ExtensionContributionDomainOptions,
  registration: ScraperRegistration,
  domain: ScraperDomain
): unknown {
  return {
    id: registration.registryProviderId,
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
          mediaType: domain.mediaType,
          providerId: registration.provider.id,
          query,
          locale
        }
      )

      return response.results
    },
    async resolve(lookup: ScraperLookup, locale: Locale) {
      const response = await requestScraperHost<{ target: unknown }>(options, domain, 'resolve', {
        runtimeHandle: registration.owner.runtimeHandle,
        mediaType: domain.mediaType,
        providerId: registration.provider.id,
        lookup,
        locale
      })

      return response.target
    },
    async openSession(target: unknown, locale: Locale) {
      const response = await requestScraperHost<{ sessionId: string }>(
        options,
        domain,
        'session.open',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          mediaType: domain.mediaType,
          providerId: registration.provider.id,
          target,
          locale
        }
      )

      return createSessionAdapter(options, registration, domain, response.sessionId)
    }
  }
}

function createSessionAdapter(
  options: ExtensionContributionDomainOptions,
  registration: ScraperRegistration,
  domain: ScraperDomain,
  sessionId: string
): unknown {
  return {
    async get(slots: readonly string[]) {
      const response = await requestScraperHost<{ result: unknown }>(
        options,
        domain,
        'session.get',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          mediaType: domain.mediaType,
          providerId: registration.provider.id,
          sessionId,
          slots
        }
      )

      return response.result
    },
    async dispose() {
      await requestScraperHost<Record<string, never>>(
        options,
        domain,
        'session.close',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          mediaType: domain.mediaType,
          providerId: registration.provider.id,
          sessionId
        },
        EXTENSION_CLEANUP_TIMEOUT_MS
      )
    }
  }
}

async function requestScraperHost<TResponse>(
  options: ExtensionContributionDomainOptions,
  domain: ScraperDomain,
  action: 'search' | 'resolve' | 'session.open' | 'session.get' | 'session.close',
  params: Record<string, unknown>,
  timeoutMs?: number
): Promise<TResponse> {
  const requestOptions = timeoutMs === undefined ? undefined : { timeoutMs }
  const response = await options.requestHost(
    getScraperRpcMethod(domain, action),
    params as never,
    requestOptions
  )

  return response as TResponse
}
