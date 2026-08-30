import type {
  GameScraperLookup,
  GameScraperProvider,
  GameScraperSession,
  GameSearchResult,
  IdResolvedTarget,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import { escapeApicalypseString } from '../../api/client'
import type { IgdbGameSearchItem, IgdbSearchResult } from '../../api/types'
import { parseIgdbEntryId } from '../../identity/entry-id'
import { findKnownIgdbId } from '../../identity/lookup'
import { toResolvedTarget } from '../../identity/target'
import { m } from '../../i18n'
import { IGDB_SEARCH_RESULT_LIMIT } from '../../utils/constants'
import { IgdbExtensionError } from '../../utils/errors'
import { GAME_SEARCH_FIELDS } from '../fields'
import { parseUnixDate } from '../format/dates'
import { toIgdbExternalId } from '../format/sites'
import type { IgdbRuntime } from '../runtime'
import { createIgdbGameSession } from './session'

export class IgdbGameProvider implements GameScraperProvider {
  public readonly id = 'igdb'
  public readonly name = 'IGDB'
  public readonly externalIdSource = 'igdb'
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'characters',
    'companies',
    'relatedEntries',
    'covers',
    'backdrops'
  ] as const

  constructor(private readonly runtime: IgdbRuntime) {}

  /**
   * The games endpoint and the cross-entity search index answer differently:
   * the former matches titles, the latter also matches alternative names and
   * franchise entries. Both are consulted so a localized or abbreviated name
   * still finds the game, with direct title matches leading.
   */
  async search(query: string, ctx: ScraperProviderContext): Promise<GameSearchResult[]> {
    const keyword = escapeApicalypseString(query.trim())
    if (!keyword) {
      return []
    }

    const request = { signal: ctx.signal }
    const [direct, indirect] = await Promise.all([
      this.runtime.client.query<IgdbGameSearchItem>(
        'games',
        `fields ${GAME_SEARCH_FIELDS}; search "${keyword}"; limit ${IGDB_SEARCH_RESULT_LIMIT};`,
        request
      ),
      this.runtime.client.query<IgdbSearchResult>(
        'search',
        `fields game,name,alternative_name; where game != null; search "${keyword}"; limit ${IGDB_SEARCH_RESULT_LIMIT};`,
        request
      )
    ])

    const byId = new Map<number, IgdbGameSearchItem>()
    for (const game of direct) {
      if (game.id > 0) {
        byId.set(game.id, game)
      }
    }

    const unresolved = indirect
      .map((entry) => entry.game ?? 0)
      .filter((id) => id > 0 && !byId.has(id))
    if (unresolved.length > 0) {
      const games = await this.runtime.client.queryByIds<IgdbGameSearchItem>(
        'games',
        unresolved,
        GAME_SEARCH_FIELDS,
        request
      )
      for (const game of games) {
        if (game.id > 0) {
          byId.set(game.id, game)
        }
      }
    }

    return [...byId.values()].slice(0, IGDB_SEARCH_RESULT_LIMIT).map((game) => ({
      id: String(game.id),
      name: game.name,
      releaseDate: parseUnixDate(game.first_release_date),
      externalIds: [toIgdbExternalId(game.id)]
    }))
  }

  async resolve(
    lookup: GameScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = findKnownIgdbId(lookup)
    if (known !== null) {
      return toResolvedTarget(String(known), lookup.name)
    }

    const first = (await this.search(lookup.name, ctx))[0]
    return first ? toResolvedTarget(first.id, first.name, first.externalIds) : null
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<GameScraperSession> {
    const gameId = parseIgdbEntryId(target.id)
    if (gameId === null) {
      throw new IgdbExtensionError('entry_id_invalid', m().errors.idInvalid({ value: target.id }))
    }

    return createIgdbGameSession(this.runtime.client, gameId, ctx.signal)
  }
}
