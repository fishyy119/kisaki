import type {
  CharacterScraperProvider,
  CharacterScraperSession,
  CharacterSearchResult,
  CharacterSessionResultMap,
  IdResolvedTarget,
  ScraperLookup,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import { findKnownAnilistId, parseAnilistId } from '../../identity/ids'
import { m } from '../../i18n'
import { ANILIST_SEARCH_RESULT_LIMIT, ANILIST_SOURCE_ID } from '../../utils/constants'
import { AnilistExtensionError } from '../../utils/errors'
import { omitUndefined } from '../../utils/object'
import { parseFuzzyDate } from '../format/dates'
import { selectPersonNames } from '../format/names'
import { toAnilistExternalId } from '../format/sites'
import type { AnilistRuntime } from '../runtime'
import { toCharacterInfo, toCharacterMetadata } from '../satellites'

/**
 * Voice credits are contributed by the media scrapes as cast facts, so the
 * standalone character session answers `info` and `photos` only.
 */
export class AnilistCharacterProvider implements CharacterScraperProvider {
  public readonly id = ANILIST_SOURCE_ID
  public readonly name = 'AniList'
  public readonly externalIdSource = ANILIST_SOURCE_ID
  public readonly capabilities = ['search', 'info', 'photos'] as const

  constructor(private readonly runtime: AnilistRuntime) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<CharacterSearchResult[]> {
    const characters = await this.runtime.client.searchCharacters(
      query,
      ANILIST_SEARCH_RESULT_LIMIT,
      { signal: ctx.signal }
    )

    const results: CharacterSearchResult[] = []
    for (const node of characters) {
      const names = selectPersonNames(node.name, { locale: ctx.locale })
      if (!names) {
        continue
      }

      results.push(
        omitUndefined({
          id: String(node.id),
          name: names.name,
          originalName: names.originalName,
          birthDate: parseFuzzyDate(node.dateOfBirth),
          externalIds: [toAnilistExternalId(node.id)]
        })
      )
    }

    return results
  }

  async resolve(lookup: ScraperLookup): Promise<IdResolvedTarget | null> {
    const known = findKnownAnilistId(lookup)
    if (known === null) {
      return null
    }

    return {
      id: String(known),
      cacheKey: `anilist:character:${known}`,
      resolveName: lookup.name,
      identity: { externalIds: [toAnilistExternalId(known)] }
    }
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<CharacterScraperSession> {
    const id = parseAnilistId(target.id)
    if (id === null) {
      throw new AnilistExtensionError(
        'entry_id_invalid',
        m().errors.idInvalid({ value: target.id })
      )
    }

    const load = memoize(() => this.runtime.client.getCharacter(id, { signal: ctx.signal }))

    return {
      get: async (slots) => {
        const node = await load()
        const metadata = toCharacterMetadata(node, { locale: ctx.locale })
        const output: Partial<CharacterSessionResultMap> = {}

        if (!metadata) {
          return { identity: { externalIds: [toAnilistExternalId(id)] }, slots: output }
        }

        for (const slot of slots) {
          if (slot === 'info') {
            const info = toCharacterInfo(node, { locale: ctx.locale })
            if (info) {
              output.info = info
            }
          }
          if (slot === 'photos' && metadata.photos && metadata.photos.length > 0) {
            output.photos = [...metadata.photos]
          }
        }

        return { identity: metadata.identity, slots: output }
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
