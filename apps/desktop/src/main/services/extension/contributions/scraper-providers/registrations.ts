/**
 * Host-side adapter that presents an extension provider as a scraper provider.
 *
 * Aborting reaches the extension: the RPC channel cancels the in-flight request
 * per call, so the host fires the provider's `ctx.signal`. Cancellation stays
 * cooperative from there, and a provider that ignores the signal runs to
 * completion. Session close is therefore never signal-bound — it is the only
 * way an abandoned session gets released on the host.
 */

import { createAbortError } from '@main/utils/async'
import type { ScraperLookup } from '@shared/scraper'
import type { ScraperProviderContext } from '@main/services/scraper'
import type { ExtensionContributionPointOptions } from '../types'
import { EXTENSION_CLEANUP_TIMEOUT_MS } from '@shared/extension/rpc-timeouts'
import { getScraperRpcMethod } from './descriptors'
import type { ScraperDomain, ScraperRegistration, ScraperRpcAction } from './domain'

export function createProviderAdapter(
  options: ExtensionContributionPointOptions,
  registration: ScraperRegistration,
  domain: ScraperDomain
): unknown {
  // The scraper registry treats a present `search` method as the implementation
  // side of the declared capability, so the adapter must omit it entirely for a
  // provider that only resolves by id.
  const capabilities: readonly string[] = registration.provider.capabilities
  const search = capabilities.includes('search')
    ? {
        async search(query: string, ctx: ScraperProviderContext) {
          const response = await requestScraperHost<{ results: readonly unknown[] }>(
            options,
            domain,
            'search',
            {
              runtimeHandle: registration.owner.runtimeHandle,
              entityType: domain.entityType,
              providerId: registration.provider.id,
              query,
              locale: ctx.locale
            },
            { signal: ctx.signal }
          )

          return response.results
        }
      }
    : {}

  return {
    id: registration.registryProviderId,
    name: registration.provider.name,
    externalIdSource: registration.provider.externalIdSource,
    capabilities: [...registration.provider.capabilities],
    ...search,
    async resolve(lookup: ScraperLookup, ctx: ScraperProviderContext) {
      const response = await requestScraperHost<{ target: unknown }>(
        options,
        domain,
        'resolve',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          entityType: domain.entityType,
          providerId: registration.provider.id,
          lookup,
          locale: ctx.locale
        },
        { signal: ctx.signal }
      )

      return response.target
    },
    async openSession(target: unknown, ctx: ScraperProviderContext) {
      const response = await requestScraperHost<{ sessionId: string }>(
        options,
        domain,
        'session.open',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          entityType: domain.entityType,
          providerId: registration.provider.id,
          target,
          locale: ctx.locale
        },
        { signal: ctx.signal }
      )

      return createSessionAdapter(options, registration, domain, response.sessionId, ctx.signal)
    }
  }
}

function createSessionAdapter(
  options: ExtensionContributionPointOptions,
  registration: ScraperRegistration,
  domain: ScraperDomain,
  sessionId: string,
  signal: AbortSignal | undefined
): unknown {
  return {
    async get(slots: readonly string[]) {
      const response = await requestScraperHost<{ result: unknown }>(
        options,
        domain,
        'session.get',
        {
          runtimeHandle: registration.owner.runtimeHandle,
          entityType: domain.entityType,
          providerId: registration.provider.id,
          sessionId,
          slots
        },
        { signal }
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
          entityType: domain.entityType,
          providerId: registration.provider.id,
          sessionId
        },
        { timeoutMs: EXTENSION_CLEANUP_TIMEOUT_MS }
      )
    }
  }
}

async function requestScraperHost<TResponse>(
  options: ExtensionContributionPointOptions,
  domain: ScraperDomain,
  action: ScraperRpcAction,
  params: Record<string, unknown>,
  request: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<TResponse> {
  const { signal, timeoutMs } = request
  if (signal?.aborted) {
    throw createAbortError()
  }

  try {
    const response = await options.requestHost(
      getScraperRpcMethod(domain, action),
      params as never,
      { signal, timeoutMs }
    )

    return response as TResponse
  } catch (error) {
    // The initiator's own signal adjudicates: only a cancellation this host
    // asked for becomes the DOM-style abort the scraper pipeline abandons.
    // A cancellation-shaped error without our abort is an extension-internal
    // leak and stays a provider failure.
    if (signal?.aborted) {
      throw createAbortError()
    }

    throw error
  }
}
