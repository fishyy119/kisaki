/**
 * Search and identity resolution shared by the standalone satellite providers.
 *
 * Bangumi numbers persons and characters in their own spaces, so each provider
 * declares which endpoint it searches and how a row becomes its search result;
 * everything else — trimming, known-id lookup, target shape — is the same.
 */

import type {
  ExternalId,
  IdResolvedTarget,
  ScraperLookup,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../api/client'
import { m } from '../i18n'
import { BANGUMI_SOURCE_ID } from '../utils/constants'
import { BangumiExtensionError } from '../utils/errors'
import { omitUndefined } from '../utils/object'
import { parseBangumiId } from './format/ids'
import { normalizeKeyText } from './format/text'

export const SATELLITE_SEARCH_RESULT_LIMIT = 25

export interface SatelliteSearchResult {
  id: string
  name: string
  originalName?: string
  externalIds: readonly ExternalId[]
}

export abstract class BangumiSatelliteProvider<TSearchResult extends SatelliteSearchResult> {
  public readonly id = BANGUMI_SOURCE_ID
  public readonly externalIdSource = BANGUMI_SOURCE_ID
  public readonly name = 'Bangumi'

  constructor(protected readonly client: BangumiClient) {}

  abstract search(query: string, ctx: ScraperProviderContext): Promise<TSearchResult[]>

  async resolve(
    lookup: ScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = findKnownBangumiId(lookup)
    if (known) {
      return toResolvedTarget(known, lookup.name)
    }

    const first = (await this.search(lookup.name, ctx))[0]
    return first
      ? toResolvedTarget(first.id, first.originalName ?? first.name, first.externalIds)
      : null
  }

  /** The target id as a Bangumi entry number; anything else is a bad target. */
  protected requireSatelliteId(value: string): number {
    try {
      return parseBangumiId(value)
    } catch {
      throw new BangumiExtensionError('bangumi_not_found', m().errors.idInvalid({ value }))
    }
  }
}

export function toResolvedTarget(
  id: string,
  resolveName?: string,
  externalIds?: readonly ExternalId[]
): IdResolvedTarget {
  const normalizedId = id.trim()

  return omitUndefined({
    id: normalizedId,
    cacheKey: normalizedId,
    resolveName: resolveName?.trim() || undefined,
    identity: externalIds ? { externalIds } : undefined
  })
}

/** The first Bangumi id the entity already carries, if any. */
export function findKnownBangumiId(lookup: ScraperLookup): string | undefined {
  const source = normalizeKeyText(BANGUMI_SOURCE_ID)

  for (const externalId of lookup.knownIds ?? []) {
    if (normalizeKeyText(externalId.source) !== source) {
      continue
    }

    try {
      return String(parseBangumiId(externalId.id))
    } catch {
      continue
    }
  }

  return undefined
}
