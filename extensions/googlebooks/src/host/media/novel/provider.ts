import type {
  IdResolvedTarget,
  NovelScraperLookup,
  NovelScraperProvider,
  NovelScraperSession,
  NovelScraperSlot,
  NovelSearchResult,
  NovelSessionResultMap,
  ScrapedNovelInfo,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { GbooksClient } from '../../api/client'
import type { GbVolume } from '../../api/types'
import { findKnownIsbn, findKnownVolumeId, parseGbooksVolumeId } from '../../identity/ids'
import { m } from '../../i18n'
import { GBOOKS_SEARCH_RESULT_LIMIT, GBOOKS_SOURCE_ID } from '../../utils/constants'
import { GbooksExtensionError } from '../../utils/errors'
import {
  buildCompanyFacts,
  buildCovers,
  buildExternalSites,
  buildPersonFacts,
  buildTags,
  buildVolumeExternalIds,
  normalizeDescription,
  parsePublishedDate
} from '../format'

/**
 * Book provider on the volumes API. Books carry no character, volume-list,
 * relation, or landscape-art facts, so those slots stay absent; no novel
 * format is stated because the catalog does not distinguish them.
 */
export class GbooksNovelProvider implements NovelScraperProvider {
  public readonly id = GBOOKS_SOURCE_ID
  public readonly name = 'Google Books'
  public readonly externalIdSource = GBOOKS_SOURCE_ID
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'persons',
    'companies',
    'covers'
  ] as const

  constructor(private readonly client: GbooksClient) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<NovelSearchResult[]> {
    const keyword = query.trim()
    if (!keyword) {
      return []
    }

    const volumes = await this.client.searchVolumes(
      `intitle:"${keyword.replace(/"/g, '')}"`,
      GBOOKS_SEARCH_RESULT_LIMIT,
      { signal: ctx.signal }
    )

    const results: NovelSearchResult[] = []
    for (const volume of volumes) {
      const name = volume.volumeInfo?.title?.trim()
      if (!name) {
        continue
      }

      results.push({
        id: volume.id,
        name,
        releaseDate: parsePublishedDate(volume.volumeInfo?.publishedDate),
        externalIds: buildVolumeExternalIds(volume)
      })
    }

    return results
  }

  async resolve(
    lookup: NovelScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = findKnownVolumeId(lookup)
    if (known !== null) {
      return this.toTarget(known, lookup.name)
    }

    // The ISBN is the shared book id: an isbn query is an exact hit.
    const isbn = findKnownIsbn(lookup)
    if (isbn !== null) {
      const volumes = await this.client.searchVolumes(`isbn:${isbn}`, 3, { signal: ctx.signal })
      const hit = volumes[0]
      if (hit) {
        return this.toTarget(hit.id, hit.volumeInfo?.title?.trim() || lookup.name)
      }
    }

    const results = await this.search(lookup.name, ctx)
    if (results.length === 0) {
      return null
    }

    // Editions share names; a stated year separates them when known.
    const wantedYear = lookup.releaseDate?.year
    const match =
      wantedYear !== undefined
        ? (results.find((entry) => entry.releaseDate?.year === wantedYear) ?? results[0]!)
        : results[0]!

    return this.toTarget(match.id, match.name)
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<NovelScraperSession> {
    const volumeId = parseGbooksVolumeId(target.id)
    if (volumeId === null) {
      throw new GbooksExtensionError('entry_id_invalid', m().errors.idInvalid({ value: target.id }))
    }

    const load = memoize(() => this.client.getVolume(volumeId, { signal: ctx.signal }))
    const tasks = new Map<NovelScraperSlot, Promise<unknown>>()

    const loadSlot = async (slot: NovelScraperSlot): Promise<unknown> => {
      switch (slot) {
        case 'info':
          return buildInfo(await load())
        case 'tags':
          return buildTags((await load()).volumeInfo)
        case 'persons':
          return buildPersonFacts((await load()).volumeInfo)
        case 'companies':
          return buildCompanyFacts((await load()).volumeInfo)
        case 'covers':
          return buildCovers((await load()).volumeInfo)
        case 'characters':
        case 'volumes':
        case 'relatedEntries':
        case 'backdrops':
        case 'logos':
          return undefined
      }
    }

    return {
      get: async (slots) => {
        const output: Partial<NovelSessionResultMap> = {}

        await Promise.all(
          slots.map(async (slot) => {
            if (!tasks.has(slot)) {
              tasks.set(slot, loadSlot(slot))
            }

            const payload = await tasks.get(slot)!
            if (payload !== undefined) {
              ;(output as Record<NovelScraperSlot, unknown>)[slot] = payload
            }
          })
        )

        return { identity: { externalIds: buildVolumeExternalIds(await load()) }, slots: output }
      }
    }
  }

  private toTarget(volumeId: string, resolveName: string): IdResolvedTarget {
    return {
      id: volumeId,
      cacheKey: `googlebooks:novel:${volumeId}`,
      resolveName,
      identity: { externalIds: [{ source: GBOOKS_SOURCE_ID, id: volumeId }] }
    }
  }
}

function buildInfo(volume: GbVolume): ScrapedNovelInfo | undefined {
  const info = volume.volumeInfo
  const title = info?.title?.trim()
  if (!title) {
    return undefined
  }

  const subtitle = info?.subtitle?.trim()

  return {
    name: subtitle ? `${title}: ${subtitle}` : title,
    aliases: subtitle ? [title] : undefined,
    releaseDate: parsePublishedDate(info?.publishedDate),
    description: normalizeDescription(info?.description),
    externalSites: buildExternalSites(info)
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
