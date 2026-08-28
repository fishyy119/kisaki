import type {
  GameScraperLookup,
  GameScraperProvider,
  GameScraperSession,
  GameSearchResult,
  IdResolvedTarget,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { SteamClient } from '../../api/client'
import { findKnownSteamAppId, parseSteamAppId } from '../../identity/ids'
import { m } from '../../i18n'
import { STEAM_SEARCH_RESULT_LIMIT, STEAM_SOURCE_ID } from '../../utils/constants'
import { SteamExtensionError } from '../../utils/errors'
import { toSteamLanguage } from '../locales'
import { createSteamGameSession } from './session'

export class SteamGameProvider implements GameScraperProvider {
  public readonly id = STEAM_SOURCE_ID
  public readonly name = 'Steam'
  public readonly externalIdSource = STEAM_SOURCE_ID
  /**
   * Steam states no per-person or character credits, and logo/icon art is
   * SteamGridDB's ground; those slots stay undeclared.
   */
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'companies',
    'relatedEntries',
    'covers',
    'backdrops'
  ] as const

  constructor(private readonly client: SteamClient) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<GameSearchResult[]> {
    const keyword = query.trim()
    if (!keyword) {
      return []
    }

    const items = await this.client.searchStore(keyword, toSteamLanguage(ctx.locale), {
      signal: ctx.signal
    })

    const results: GameSearchResult[] = []
    for (const item of items.slice(0, STEAM_SEARCH_RESULT_LIMIT)) {
      const name = item.name?.trim()
      if (!name || !Number.isInteger(item.id)) {
        continue
      }

      results.push({
        id: String(item.id),
        name,
        externalIds: [{ source: STEAM_SOURCE_ID, id: String(item.id) }]
      })
    }

    return results
  }

  async resolve(
    lookup: GameScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = findKnownSteamAppId(lookup)
    if (known !== null) {
      return this.toTarget(known, lookup.name)
    }

    const results = await this.search(lookup.name, ctx)
    if (results.length === 0) {
      return null
    }

    // Store search returns no dates, so the first hit is the resolution.
    const match = results[0]!
    return this.toTarget(Number(match.id), match.name)
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<GameScraperSession> {
    const appId = parseSteamAppId(target.id)
    if (appId === null) {
      throw new SteamExtensionError('entry_id_invalid', m().errors.idInvalid({ value: target.id }))
    }

    return createSteamGameSession(this.client, appId, ctx.locale, ctx.signal)
  }

  private toTarget(appId: number, resolveName: string): IdResolvedTarget {
    return {
      id: String(appId),
      cacheKey: `steam:game:${appId}`,
      resolveName,
      identity: { externalIds: [{ source: STEAM_SOURCE_ID, id: String(appId) }] }
    }
  }
}
