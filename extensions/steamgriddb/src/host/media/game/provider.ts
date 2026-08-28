import type {
  GameScraperLookup,
  GameScraperProvider,
  GameScraperSession,
  GameSearchResult,
  GameSessionResultMap,
  GameScraperSlot,
  IdResolvedTarget,
  PartialDate,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { SgdbClient } from '../../api/client'
import { m } from '../../i18n'
import { SGDB_SEARCH_RESULT_LIMIT, SGDB_SOURCE_ID, STEAM_SOURCE_ID } from '../../utils/constants'
import { SgdbExtensionError } from '../../utils/errors'
import { omitUndefined } from '../../utils/object'

/**
 * Artwork-only game provider: covers (600×900 grids), hero backdrops, logos,
 * and icons. Entries carrying a Steam app id resolve through the id bridge;
 * everything else resolves by name search.
 */
export class SgdbGameProvider implements GameScraperProvider {
  public readonly id = SGDB_SOURCE_ID
  public readonly name = 'SteamGridDB'
  public readonly externalIdSource = SGDB_SOURCE_ID
  public readonly capabilities = ['search', 'covers', 'backdrops', 'logos', 'icons'] as const

  constructor(private readonly client: SgdbClient) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<GameSearchResult[]> {
    const keyword = query.trim()
    if (!keyword) {
      return []
    }

    const games = await this.client.searchGames(keyword, { signal: ctx.signal })

    const results: GameSearchResult[] = []
    for (const game of games.slice(0, SGDB_SEARCH_RESULT_LIMIT)) {
      const name = game.name?.trim()
      if (!name) {
        continue
      }

      results.push(
        omitUndefined({
          id: String(game.id),
          name,
          releaseDate: toReleaseDate(game.release_date),
          externalIds: [{ source: SGDB_SOURCE_ID, id: String(game.id) }]
        })
      )
    }

    return results
  }

  async resolve(
    lookup: GameScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const knownSgdbId = findKnownId(lookup, SGDB_SOURCE_ID)
    if (knownSgdbId !== null) {
      return this.toTarget(knownSgdbId, lookup.name)
    }

    // A Steam app id identifies the entry exactly; bridge it to the SGDB id.
    const steamAppId = findKnownId(lookup, STEAM_SOURCE_ID)
    if (steamAppId !== null) {
      const game = await this.client.getGameBySteamAppId(steamAppId, { signal: ctx.signal })
      return this.toTarget(game.id, game.name?.trim() || lookup.name)
    }

    const results = await this.search(lookup.name, ctx)
    if (results.length === 0) {
      return null
    }

    // Franchises share names; a stated year separates a work from its sequels.
    const wantedYear = lookup.releaseDate?.year
    const match =
      wantedYear !== undefined
        ? (results.find((entry) => entry.releaseDate?.year === wantedYear) ?? results[0]!)
        : results[0]!

    return this.toTarget(Number(match.id), match.name)
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<GameScraperSession> {
    const gameId = Number(target.id)
    if (!Number.isSafeInteger(gameId) || gameId <= 0) {
      throw new SgdbExtensionError('entry_id_invalid', m().errors.idInvalid({ value: target.id }))
    }

    const client = this.client
    const tasks = new Map<GameScraperSlot, Promise<unknown>>()

    const loadArt = async (kind: 'grids' | 'heroes' | 'logos' | 'icons'): Promise<string[]> => {
      const artworks = await client.listArtwork(kind, gameId, { signal: ctx.signal })
      const urls: string[] = []
      const seen = new Set<string>()
      for (const artwork of artworks) {
        const url = artwork.url?.trim()
        if (url && !seen.has(url)) {
          seen.add(url)
          urls.push(url)
        }
      }
      return urls
    }

    const loadSlot = (slot: GameScraperSlot): Promise<unknown> => {
      switch (slot) {
        case 'covers':
          return loadArt('grids')
        case 'backdrops':
          return loadArt('heroes')
        case 'logos':
          return loadArt('logos')
        case 'icons':
          return loadArt('icons')
        default:
          return Promise.resolve(undefined)
      }
    }

    return {
      get: async (slots) => {
        const output: Partial<GameSessionResultMap> = {}

        await Promise.all(
          slots.map(async (slot) => {
            if (!tasks.has(slot)) {
              tasks.set(slot, loadSlot(slot))
            }

            const payload = await tasks.get(slot)!
            if (payload !== undefined) {
              ;(output as Record<GameScraperSlot, unknown>)[slot] = payload
            }
          })
        )

        return {
          identity: { externalIds: [{ source: SGDB_SOURCE_ID, id: String(gameId) }] },
          slots: output
        }
      }
    }
  }

  private toTarget(gameId: number, resolveName: string): IdResolvedTarget {
    return {
      id: String(gameId),
      cacheKey: `steamgriddb:game:${gameId}`,
      resolveName,
      identity: { externalIds: [{ source: SGDB_SOURCE_ID, id: String(gameId) }] }
    }
  }
}

function findKnownId(lookup: GameScraperLookup, source: string): number | null {
  for (const entry of lookup.knownIds ?? []) {
    if (entry.source.trim().toLowerCase() !== source) {
      continue
    }

    const raw = entry.id.trim()
    if (!/^\d+$/.test(raw)) {
      continue
    }

    const id = Number(raw)
    if (Number.isSafeInteger(id) && id > 0) {
      return id
    }
  }

  return null
}

function toReleaseDate(unixSeconds: number | null | undefined): PartialDate | undefined {
  if (typeof unixSeconds !== 'number' || !Number.isFinite(unixSeconds) || unixSeconds <= 0) {
    return undefined
  }

  const date = new Date(unixSeconds * 1000)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  }
}
