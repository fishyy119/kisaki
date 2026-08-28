import type {
  GameScraperLookup,
  GameScraperProvider,
  GameScraperSession,
  GameSearchResult,
  IdResolvedTarget,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { YmgalGame, YmgalGameSearchListItem } from '../../api/types'
import { parseYmgalArchiveId } from '../../identity/archive-id'
import { findKnownYmgalId } from '../../identity/lookup'
import { toResolvedTarget } from '../../identity/target'
import { m } from '../../i18n'
import { YMGAL_SEARCH_RESULT_LIMIT, YMGAL_SOURCE_ID } from '../../utils/constants'
import { YmgalExtensionError } from '../../utils/errors'
import { omitUndefined } from '../../utils/object'
import { parseYmgalDate } from '../format/dates'
import { resolveDisplayName } from '../format/names'
import { createRequestContext, type YmgalRequestContext, type YmgalRuntime } from '../runtime'
import { buildGameIdentity, createYmgalGameSession } from './session'

export class YmgalGameProvider implements GameScraperProvider {
  public readonly id = YMGAL_SOURCE_ID
  public readonly name = 'YMGal'
  public readonly externalIdSource = YMGAL_SOURCE_ID
  /**
   * The open-api game archive carries no tag vocabulary and no related-work
   * links (verified against the live API: the archive exposes staff,
   * characters, releases, and websites only), so `tags` and `relatedEntries`
   * stay undeclared rather than answering empty.
   */
  public readonly capabilities = [
    'search',
    'info',
    'characters',
    'persons',
    'companies',
    'covers'
  ] as const

  constructor(private readonly runtime: YmgalRuntime) {}

  /**
   * Accurate mode first, then the list search.
   *
   * The two modes answer different questions — one best match versus what the
   * site's own search returns — and the exact match is what a scanner-derived
   * name usually wants, so it leads the ordering.
   */
  async search(query: string, ctx: ScraperProviderContext): Promise<GameSearchResult[]> {
    const keyword = query.trim()
    if (!keyword) {
      return []
    }

    const request = await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    const [accurate, page] = await Promise.all([
      this.runtime.client.searchGameAccurate(keyword, { signal: ctx.signal }),
      this.runtime.client.searchGameList(keyword, { signal: ctx.signal })
    ])

    const results: GameSearchResult[] = []
    const seen = new Set<string>()

    const push = (result: GameSearchResult | null): void => {
      if (!result || seen.has(result.id)) {
        return
      }
      seen.add(result.id)
      results.push(result)
    }

    if (accurate?.game) {
      push(toGameSearchResult(accurate.game, request))
    }
    for (const item of page.result ?? []) {
      push(toListSearchResult(item, request))
    }

    return results.slice(0, YMGAL_SEARCH_RESULT_LIMIT)
  }

  async resolve(
    lookup: GameScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = findKnownYmgalId(lookup)
    if (known) {
      return toResolvedTarget(known, lookup.name)
    }

    const first = (await this.search(lookup.name, ctx))[0]
    return first
      ? toResolvedTarget(first.id, first.originalName ?? first.name, first.externalIds)
      : null
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<GameScraperSession> {
    const gameId = parseYmgalArchiveId(target.id)
    if (!gameId) {
      throw new YmgalExtensionError(
        'archive_id_invalid',
        m().errors.idInvalid({ value: target.id })
      )
    }

    return createYmgalGameSession(
      this.runtime.client,
      gameId,
      await createRequestContext(this.runtime, ctx.locale, ctx.signal)
    )
  }
}

function toGameSearchResult(game: YmgalGame, ctx: YmgalRequestContext): GameSearchResult | null {
  const gameId = parseYmgalArchiveId(game.gid)
  if (!gameId) {
    return null
  }

  const { name, originalName } = resolveDisplayName(game.name, game.chineseName, ctx, gameId)

  return omitUndefined({
    id: gameId,
    name,
    originalName,
    releaseDate: parseYmgalDate(game.releaseDate),
    externalIds: buildGameIdentity(gameId, game).externalIds
  })
}

function toListSearchResult(
  item: YmgalGameSearchListItem,
  ctx: YmgalRequestContext
): GameSearchResult | null {
  const gameId = parseYmgalArchiveId(item.id) ?? parseYmgalArchiveId(item.gid)
  if (!gameId) {
    return null
  }

  const { name, originalName } = resolveDisplayName(item.name, item.chineseName, ctx, gameId)

  return omitUndefined({
    id: gameId,
    name,
    originalName,
    releaseDate: parseYmgalDate(item.releaseDate),
    externalIds: [{ source: YMGAL_SOURCE_ID, id: gameId }]
  })
}
