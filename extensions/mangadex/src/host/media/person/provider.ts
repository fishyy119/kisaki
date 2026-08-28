import type {
  IdResolvedTarget,
  PersonScraperProvider,
  PersonScraperSession,
  PersonSearchResult,
  PersonSessionResultMap,
  ScraperLookup,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { MangadexClient } from '../../api/client'
import { findKnownMangadexId, parseMangadexId } from '../../identity/ids'
import { m } from '../../i18n'
import { MANGADEX_SEARCH_RESULT_LIMIT, MANGADEX_SOURCE_ID } from '../../utils/constants'
import { MangadexExtensionError } from '../../utils/errors'
import { toMangadexExternalId, toPersonInfo } from '../format/facts'

/** Author and artist entities; MangaDex states name, portrait, bio, and links. */
export class MangadexPersonProvider implements PersonScraperProvider {
  public readonly id = MANGADEX_SOURCE_ID
  public readonly name = 'MangaDex'
  public readonly externalIdSource = MANGADEX_SOURCE_ID
  public readonly capabilities = ['search', 'info', 'photos'] as const

  constructor(private readonly client: MangadexClient) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<PersonSearchResult[]> {
    const keyword = query.trim()
    if (!keyword) {
      return []
    }

    const authors = await this.client.searchAuthors(keyword, MANGADEX_SEARCH_RESULT_LIMIT, {
      signal: ctx.signal
    })

    const results: PersonSearchResult[] = []
    for (const author of authors) {
      const name = author.attributes?.name?.trim()
      if (!name) {
        continue
      }

      results.push({
        id: author.id,
        name,
        externalIds: [toMangadexExternalId(author.id)]
      })
    }

    return results
  }

  async resolve(lookup: ScraperLookup): Promise<IdResolvedTarget | null> {
    const known = findKnownMangadexId(lookup)
    if (known === null) {
      return null
    }

    return {
      id: known,
      cacheKey: `mangadex:person:${known}`,
      resolveName: lookup.name,
      identity: { externalIds: [toMangadexExternalId(known)] }
    }
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<PersonScraperSession> {
    const authorId = parseMangadexId(target.id)
    if (authorId === null) {
      throw new MangadexExtensionError(
        'entry_id_invalid',
        m().errors.idInvalid({ value: target.id })
      )
    }

    const load = memoize(() => this.client.getAuthor(authorId, { signal: ctx.signal }))

    return {
      get: async (slots) => {
        const author = await load()
        const output: Partial<PersonSessionResultMap> = {}

        for (const slot of slots) {
          if (slot === 'info') {
            const info = toPersonInfo(author, ctx.locale)
            if (info) {
              output.info = info
            }
          }
          if (slot === 'photos') {
            const photo = author.attributes?.imageUrl?.trim()
            if (photo) {
              output.photos = [photo]
            }
          }
        }

        return { identity: { externalIds: [toMangadexExternalId(authorId)] }, slots: output }
      }
    }
  }
}

function memoize<T>(load: () => Promise<T>): () => Promise<T> {
  let value: T | undefined
  let loaded = false

  return async () => {
    if (!loaded) {
      value = await load()
      loaded = true
    }
    return value as T
  }
}
