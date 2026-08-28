import type {
  ContentLocale,
  IdResolvedTarget,
  NovelScraperLookup,
  NovelScraperProvider,
  NovelScraperSession,
  NovelScraperSlot,
  NovelSearchResult,
  NovelSessionResultMap,
  ScrapedNovelInfo,
  ScrapedTag,
  ScraperProviderContext
} from '@kisaki3/extension-sdk'
import type { NeodbClient } from '../../api/client'
import type { NdBook } from '../../api/types'
import type { NeodbSettingsV1 } from '../../config/schema'
import { findKnownIsbn, findKnownNeodbId, parseNeodbId } from '../../identity/ids'
import { m } from '../../i18n'
import { NEODB_SEARCH_RESULT_LIMIT, NEODB_SOURCE_ID } from '../../utils/constants'
import { NeodbExtensionError } from '../../utils/errors'
import { omitUndefined } from '../../utils/object'
import {
  buildBookExternalIds,
  buildCompanyFacts,
  buildExternalSites,
  buildPersonFacts,
  buildReleaseDate,
  pickItemTitle,
  pickLocalizedText
} from '../format'

/**
 * Book provider on the NeoDB catalog. Books do not distinguish light novels,
 * so no format is stated; characters, volumes, related entries, and landscape
 * art are absent because the catalog states none of them.
 */
export class NeodbNovelProvider implements NovelScraperProvider {
  public readonly id = NEODB_SOURCE_ID
  public readonly name = 'NeoDB'
  public readonly externalIdSource = NEODB_SOURCE_ID
  public readonly capabilities = [
    'search',
    'info',
    'tags',
    'persons',
    'companies',
    'covers'
  ] as const

  constructor(
    private readonly client: NeodbClient,
    private readonly getSettings: () => Promise<NeodbSettingsV1>
  ) {}

  async search(query: string, ctx: ScraperProviderContext): Promise<NovelSearchResult[]> {
    const keyword = query.trim()
    if (!keyword) {
      return []
    }

    const page = await this.client.searchBooks(keyword, 1, { signal: ctx.signal })

    const results: NovelSearchResult[] = []
    for (const item of (page.data ?? []).slice(0, NEODB_SEARCH_RESULT_LIMIT)) {
      if (item.category !== 'book') {
        continue
      }

      const name = pickItemTitle(item, ctx.locale)
      if (!name) {
        continue
      }

      results.push({
        id: item.uuid,
        name,
        externalIds: [{ source: NEODB_SOURCE_ID, id: item.uuid }]
      })
    }

    return results
  }

  async resolve(
    lookup: NovelScraperLookup,
    ctx: ScraperProviderContext
  ): Promise<IdResolvedTarget | null> {
    const known = findKnownNeodbId(lookup)
    if (known !== null) {
      return this.toTarget(known, lookup.name)
    }

    // The ISBN is the shared book id: a catalog search on it is an exact hit.
    const isbn = findKnownIsbn(lookup)
    if (isbn !== null) {
      const page = await this.client.searchBooks(isbn, 1, { signal: ctx.signal })
      const hit = (page.data ?? []).find((item) => item.category === 'book')
      if (hit) {
        return this.toTarget(hit.uuid, pickItemTitle(hit, ctx.locale) ?? lookup.name)
      }
    }

    const results = await this.search(lookup.name, ctx)
    if (results.length === 0) {
      return null
    }

    return this.toTarget(results[0]!.id, results[0]!.name)
  }

  async openSession(
    target: IdResolvedTarget,
    ctx: ScraperProviderContext
  ): Promise<NovelScraperSession> {
    const uuid = parseNeodbId(target.id)
    if (uuid === null) {
      throw new NeodbExtensionError('entry_id_invalid', m().errors.idInvalid({ value: target.id }))
    }

    const settings = await this.getSettings()
    return createNovelSession(this.client, settings, uuid, ctx.locale, ctx.signal)
  }

  private toTarget(uuid: string, resolveName: string): IdResolvedTarget {
    return {
      id: uuid,
      cacheKey: `neodb:novel:${uuid}`,
      resolveName,
      identity: { externalIds: [{ source: NEODB_SOURCE_ID, id: uuid }] }
    }
  }
}

function createNovelSession(
  client: NeodbClient,
  settings: NeodbSettingsV1,
  uuid: string,
  locale: ContentLocale,
  signal: AbortSignal
): NovelScraperSession {
  const getBook = memoize(() => client.getBook(uuid, { signal }))
  const tasks = new Map<NovelScraperSlot, Promise<unknown>>()

  const loadSlot = async (slot: NovelScraperSlot): Promise<unknown> => {
    switch (slot) {
      case 'info':
        return buildInfo(await getBook(), settings.endpoints.instanceUrl, locale)
      case 'tags':
        return buildTags(await getBook())
      case 'persons':
        return buildPersonFacts(await getBook())
      case 'companies':
        return buildCompanyFacts(await getBook())
      case 'covers': {
        const cover = (await getBook()).cover_image_url?.trim()
        return cover ? [cover] : []
      }
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

      return { identity: { externalIds: buildBookExternalIds(await getBook()) }, slots: output }
    }
  }
}

function buildInfo(
  book: NdBook,
  instanceUrl: string,
  locale: ContentLocale
): ScrapedNovelInfo | undefined {
  const localized = pickLocalizedText(book.localized_title, locale)
  const fallback = book.display_title?.trim() || book.title?.trim()
  const name = localized ?? fallback
  if (!name) {
    return undefined
  }

  const original = book.orig_title?.trim()
  const aliases = dedupeNames(
    [
      fallback,
      ...(book.localized_title ?? []).map((entry) => entry.text?.trim()),
      book.subtitle?.trim()
    ],
    [name, original ?? '']
  )

  const description =
    pickLocalizedText(book.localized_description, locale) ??
    book.description?.trim() ??
    book.brief?.trim()

  return omitUndefined({
    name,
    originalName: original,
    aliases: aliases.length > 0 ? aliases : undefined,
    releaseDate: buildReleaseDate(book),
    description: description || undefined,
    externalSites: buildExternalSites(book, instanceUrl)
  })
}

function buildTags(book: NdBook): ScrapedTag[] {
  const tags: ScrapedTag[] = []
  const seen = new Set<string>()

  for (const tag of book.tags ?? []) {
    const name = tag?.trim()
    if (name && !seen.has(name)) {
      seen.add(name)
      tags.push({ name })
    }
  }

  return tags
}

function dedupeNames(
  candidates: readonly (string | null | undefined)[],
  exclude: readonly string[]
): string[] {
  const excluded = new Set(exclude.map((value) => value.trim()).filter(Boolean))
  const seen = new Set<string>()
  const names: string[] = []

  for (const candidate of candidates) {
    const value = candidate?.trim()
    if (!value || excluded.has(value) || seen.has(value)) {
      continue
    }
    seen.add(value)
    names.push(value)
  }

  return names
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
