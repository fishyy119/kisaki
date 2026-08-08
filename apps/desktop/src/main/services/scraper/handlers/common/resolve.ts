/**
 * Shared resolve orchestration built on top of invocation state caches.
 */

import { isAbortError } from '@main/utils/async'
import type { ScraperLookup } from '@shared/scraper'
import type { BaseResolvedTarget, BaseScraperSession, ScraperProviderContext } from '../../types'
import type { ScraperInvocationState } from './state'

export interface ResolveCapableScraperProvider<TTarget extends BaseResolvedTarget> {
  resolve(lookup: ScraperLookup, ctx: ScraperProviderContext): Promise<TTarget | null>
}

/**
 * Replace the lookup name when a provider resolve yields a better canonical name.
 */
export function createCanonicalLookup(lookup: ScraperLookup, resolveName?: string): ScraperLookup {
  const canonicalName = resolveName?.trim()
  if (!canonicalName || canonicalName === lookup.name) {
    return lookup
  }

  return {
    ...lookup,
    name: canonicalName
  }
}

/**
 * Resolve a provider target through invocation-scoped promise caching.
 */
export async function resolveProviderTarget<
  TTarget extends BaseResolvedTarget,
  TSession extends BaseScraperSession<TSlot, TResultMap>,
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>,
  TResult,
  TProvider extends ResolveCapableScraperProvider<TTarget>
>(options: {
  state: ScraperInvocationState<TTarget, TSession, TSlot, TResultMap, TResult>
  providerId: string
  provider: TProvider
  lookup: ScraperLookup
  ctx: ScraperProviderContext
}): Promise<TTarget | null> {
  return options.state.getOrCreateResolvedTarget(
    options.providerId,
    options.lookup,
    options.ctx.locale,
    () => options.provider.resolve(options.lookup, options.ctx)
  )
}

/**
 * Resolve the search provider first and derive the canonical lookup name for follow-up providers.
 */
export async function resolveSearchProviderTarget<
  TTarget extends BaseResolvedTarget,
  TSession extends BaseScraperSession<TSlot, TResultMap>,
  TSlot extends string,
  TResultMap extends Partial<Record<TSlot, unknown>>,
  TResult,
  TProvider extends ResolveCapableScraperProvider<TTarget>
>(options: {
  state: ScraperInvocationState<TTarget, TSession, TSlot, TResultMap, TResult>
  providerId: string
  provider: TProvider
  lookup: ScraperLookup
  ctx: ScraperProviderContext
  warn?: (message: string, error?: unknown) => void
}): Promise<{
  target: TTarget | null
  canonicalLookup: ScraperLookup
}> {
  try {
    const target = await resolveProviderTarget(options)

    return {
      target,
      canonicalLookup: createCanonicalLookup(options.lookup, target?.resolveName)
    }
  } catch (error) {
    // A cancelled resolve must not degrade into an unresolved lookup.
    if (isAbortError(error)) {
      throw error
    }

    options.warn?.(`Search provider '${options.providerId}' resolve failed:`, error)

    return {
      target: null,
      canonicalLookup: options.lookup
    }
  }
}
