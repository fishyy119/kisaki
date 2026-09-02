/**
 * Comic session: one detail read answers info, tags, persons, and related
 * entries; the cover listing answers the covers slot with per-volume art.
 * MangaDex states no character, chapter-metadata, company, or landscape-art
 * facts, so those slots stay absent.
 */

import type {
  ComicScraperSession,
  ComicScraperSlot,
  ComicSessionResultMap,
  ContentLocale,
  ScrapedComicInfo,
  ScrapedComicPersonFact,
  ScrapedEntityIdentity,
  ScrapedRelatedEntryFact,
  ScrapedTag
} from '@kisaki3/extension-sdk'
import type { MangadexClient } from '../../api/client'
import type { MdCover, MdManga } from '../../api/types'
import { MANGADEX_SOURCE_ID, MANGADEX_UPLOADS_URL } from '../../utils/constants'
import {
  buildComicFormat,
  buildExternalSites,
  buildMangaExternalIds,
  buildReleaseDate,
  mapRelationType,
  toCreditedPerson
} from '../format/facts'
import { selectDescription, selectMangaTitles } from '../format/titles'

export interface ComicSessionContext {
  locale: ContentLocale
  preferRomanized: boolean
}

export function createMangadexComicSession(
  client: MangadexClient,
  mangaId: string,
  ctx: ComicSessionContext,
  signal: AbortSignal
): ComicScraperSession {
  const getManga = memoize(() => client.getManga(mangaId, { signal }))
  const getCovers = memoize(() => client.listCovers(mangaId, { signal }))
  const tasks = new Map<ComicScraperSlot, Promise<unknown>>()

  const loadSlot = async (slot: ComicScraperSlot): Promise<unknown> => {
    switch (slot) {
      case 'info':
        return buildInfo(await getManga(), ctx)
      case 'tags':
        return buildTags(await getManga())
      case 'persons':
        return buildPersons(await getManga(), ctx)
      case 'relatedEntries':
        return buildRelatedEntries(await getManga())
      case 'covers':
        return buildCovers(await getManga(), await getCovers())
      case 'characters':
      case 'chapters':
      case 'companies':
      case 'backdrops':
      case 'logos':
        return undefined
    }
  }

  return {
    get: async (slots) => {
      const output: Partial<ComicSessionResultMap> = {}

      await Promise.all(
        slots.map(async (slot) => {
          if (!tasks.has(slot)) {
            tasks.set(slot, loadSlot(slot))
          }

          const payload = await tasks.get(slot)!
          if (payload !== undefined) {
            ;(output as Record<ComicScraperSlot, unknown>)[slot] = payload
          }
        })
      )

      return { identity: await buildIdentity(getManga), slots: output }
    }
  }
}

async function buildIdentity(getManga: () => Promise<MdManga>): Promise<ScrapedEntityIdentity> {
  return { externalIds: buildMangaExternalIds(await getManga()) }
}

function buildInfo(manga: MdManga, ctx: ComicSessionContext): ScrapedComicInfo | undefined {
  const attributes = manga.attributes
  const titles = selectMangaTitles(attributes, ctx)
  if (!titles) {
    return undefined
  }

  return {
    name: titles.name,
    originalName: titles.originalName,
    aliases: titles.aliases,
    releaseDate: buildReleaseDate(attributes),
    description: selectDescription(attributes?.description, ctx.locale),
    format: buildComicFormat(attributes),
    totalVolumes: parseCount(attributes?.lastVolume),
    totalChapters: parseCount(attributes?.lastChapter),
    externalSites: buildExternalSites(manga)
  }
}

/** Tag names are curated English vocabulary; groups are not repeated as text. */
function buildTags(manga: MdManga): ScrapedTag[] {
  const tags: ScrapedTag[] = []
  const seen = new Set<string>()

  for (const tag of manga.attributes?.tags ?? []) {
    const name = tag.attributes?.name?.en?.trim()
    if (!name || seen.has(name)) {
      continue
    }
    seen.add(name)
    tags.push({ name })
  }

  return tags
}

/** Author and artist credits; one person holding both reads as story & art. */
function buildPersons(manga: MdManga, ctx: ComicSessionContext): ScrapedComicPersonFact[] {
  const authors = new Map<string, ScrapedComicPersonFact>()

  for (const relationship of manga.relationships ?? []) {
    if (relationship.type !== 'author' && relationship.type !== 'artist') {
      continue
    }

    const person = toCreditedPerson(relationship, ctx.locale)
    if (!person) {
      continue
    }

    const existing = authors.get(relationship.id)
    if (existing) {
      // Present as both author and artist: the story-and-art author.
      existing.role = 'author'
      existing.note = 'Story & Art'
      continue
    }

    authors.set(relationship.id, {
      ...person,
      role: relationship.type === 'author' ? 'author' : 'art',
      note: relationship.type === 'author' ? 'Story' : 'Art'
    })
  }

  return [...authors.values()]
}

function buildRelatedEntries(manga: MdManga): ScrapedRelatedEntryFact[] {
  const facts: ScrapedRelatedEntryFact[] = []

  for (const relationship of manga.relationships ?? []) {
    if (relationship.type !== 'manga') {
      continue
    }

    const mapping = mapRelationType(relationship.related)
    if (!mapping) {
      continue
    }

    facts.push({
      mediaType: 'comic',
      source: MANGADEX_SOURCE_ID,
      externalId: relationship.id,
      type: mapping.type,
      note: mapping.note
    })
  }

  return facts
}

/** Primary cover first, then every volume cover in ascending volume order. */
function buildCovers(manga: MdManga, covers: MdCover[]): string[] {
  const urls: string[] = []
  const seen = new Set<string>()

  const push = (fileName: string | null | undefined): void => {
    const trimmed = fileName?.trim()
    if (!trimmed) {
      return
    }
    const url = `${MANGADEX_UPLOADS_URL}/covers/${manga.id}/${trimmed}`
    if (!seen.has(url)) {
      seen.add(url)
      urls.push(url)
    }
  }

  for (const relationship of manga.relationships ?? []) {
    if (relationship.type === 'cover_art') {
      push((relationship.attributes as { fileName?: string } | null)?.fileName)
    }
  }
  for (const cover of covers) {
    push(cover.attributes?.fileName)
  }

  return urls
}

function parseCount(value: string | null | undefined): number | undefined {
  const match = /^(\d+)/.exec(value?.trim() ?? '')
  if (!match) {
    return undefined
  }

  const count = Number(match[1])
  return Number.isInteger(count) && count > 0 ? count : undefined
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
