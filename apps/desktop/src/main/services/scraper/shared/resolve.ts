/**
 * Shared resolve orchestration built on top of invocation state caches.
 */

import { isAbortError } from '@main/utils/async'
import type { ScraperLookup } from '@shared/scraper'
import type { BaseResolvedTarget, BaseScraperSession, ScraperProviderContext } from '../types'
import type { ScraperInvocationState } from './state'

export interface ResolveCapableScraperProvider<
  TTarget extends BaseResolvedTarget,
  TLookup extends ScraperLookup
> {
  resolve(lookup: TLookup, ctx: ScraperProviderContext): Promise<TTarget | null>
}

/**
 * Replace the lookup name when a provider resolve yields a better canonical name.
 *
 * Everything else the lookup knows about the entry is preserved, so follow-up
 * providers keep the facts that let them disambiguate their own name search.
 */
export function createCanonicalLookup<TLookup extends ScraperLookup>(
  lookup: TLookup,
  resolveName?: string
): TLookup {
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
  TLookup extends ScraperLookup,
  TProvider extends ResolveCapableScraperProvider<TTarget, TLookup>
>(options: {
  state: ScraperInvocationState<TTarget, TSession, TSlot, TResultMap, TResult>
  providerId: string
  provider: TProvider
  lookup: TLookup
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
  TLookup extends ScraperLookup,
  TProvider extends ResolveCapableScraperProvider<TTarget, TLookup>
>(options: {
  state: ScraperInvocationState<TTarget, TSession, TSlot, TResultMap, TResult>
  providerId: string
  provider: TProvider
  lookup: TLookup
  ctx: ScraperProviderContext
  warn?: (message: string, error?: unknown) => void
}): Promise<{
  target: TTarget | null
  canonicalLookup: TLookup
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
