/**
 * Media sessions for the three kinds MAL serves.
 *
 * Core metadata, tags, covers, companies, and related entries come from the
 * official API; characters, staff, and episodes come from the mirror. Mirror
 * slots follow enrichment semantics: when the mirror is disabled or
 * unreachable they are absent, never a scrape failure.
 */

import {
  isCancellationError,
  type AnimeScraperSession,
  type AnimeScraperSlot,
  type AnimeSessionResultMap,
  type ComicScraperSession,
  type ComicScraperSlot,
  type ComicSessionResultMap,
  type ContentLocale,
  type ExtensionLogger,
  type ExternalSite,
  type NovelScraperSession,
  type NovelScraperSlot,
  type NovelSessionResultMap,
  type PartialDate,
  type ScrapedAnimeEpisode,
  type ScrapedAnimeInfo,
  type ScrapedComicInfo,
  type ScrapedCompanyMetadata,
  type ScrapedEntityIdentity,
  type ScrapedNovelInfo,
  type ScrapedPersonMetadata,
  type ScrapedRelatedEntryFact,
  type ScrapedTag
} from '@kisaki3/extension-sdk'
import type {
  MalAnimeDetail,
  MalAuthorEdge,
  MalMangaDetail,
  MalRelatedEdge,
  MirrorCharacterEdge,
  MirrorEpisode,
  MirrorStaffEdge
} from '../api/types'
import type { MalSettingsV1 } from '../config/schema'
import { MAL_SOURCE_ID } from '../utils/constants'
import { toSafeErrorLog } from '../utils/errors'
import { parseMalDate, parseMirrorAired } from './format/dates'
import { selectMalTitles } from './format/names'
import { mapComicAuthorRole, mapNovelAuthorRole, mapRelationType } from './format/roles'
import { dedupeUrls, malEntrySite, toMalExternalId } from './format/sites'
import { normalizeSynopsis, trimToUndefined } from './format/text'
import {
  mapAnimeFormat,
  mapComicFormat,
  mapNovelFormat,
  resolveMangaKind,
  type MalMediaKind
} from './kinds'
import type { MalRuntime } from './runtime'
import { toCharacterFact, toStaffFact } from './satellites'

export interface MediaSessionContext {
  locale: ContentLocale
  preferRomaji: boolean
  logger: ExtensionLogger
}

export function createSessionContext(
  settings: MalSettingsV1,
  locale: ContentLocale,
  logger: ExtensionLogger
): MediaSessionContext {
  return { locale, preferRomaji: settings.naming.preferRomajiTitles, logger }
}

export function createMalAnimeSession(
  runtime: MalRuntime,
  animeId: number,
  ctx: MediaSessionContext,
  signal: AbortSignal
): AnimeScraperSession {
  const getDetail = memoize(() => runtime.official.getAnime(animeId, { signal }))
  const getCharacters = memoize(() =>
    loadMirrorSlot(runtime, ctx, () => runtime.mirror.getAnimeCharacters(animeId, { signal }))
  )
  const getStaff = memoize(() =>
    loadMirrorSlot(runtime, ctx, () => runtime.mirror.getAnimeStaff(animeId, { signal }))
  )
  const getEpisodes = memoize(() =>
    loadMirrorSlot(runtime, ctx, () => runtime.mirror.getAnimeEpisodes(animeId, { signal }))
  )
  const tasks = new Map<AnimeScraperSlot, Promise<unknown>>()

  const loadSlot = async (slot: AnimeScraperSlot): Promise<unknown> => {
    switch (slot) {
      case 'info':
        return buildAnimeInfo(await getDetail(), ctx)
      case 'tags':
        return buildTags(await getDetail())
      case 'companies':
        return buildStudios(await getDetail())
      case 'relatedEntries':
        return buildRelatedEntries(await getDetail())
      case 'covers':
        return buildCovers(await getDetail())
      case 'characters':
        return buildCharacterFacts(await getCharacters())
      case 'persons':
        return buildStaffFacts(await getStaff())
      case 'episodes':
        return buildEpisodes(await getEpisodes())
      case 'backdrops':
      case 'logos':
        return undefined
    }
  }

  return {
    get: async (slots) => {
      const output: Partial<AnimeSessionResultMap> = {}

      await Promise.all(
        slots.map(async (slot) => {
          if (!tasks.has(slot)) {
            tasks.set(slot, loadSlot(slot))
          }

          const payload = await tasks.get(slot)!
          if (payload !== undefined) {
            ;(output as Record<AnimeScraperSlot, unknown>)[slot] = payload
          }
        })
      )

      return { identity: buildIdentity(animeId), slots: output }
    }
  }
}

export function createMalComicSession(
  runtime: MalRuntime,
  mangaId: number,
  ctx: MediaSessionContext,
  signal: AbortSignal
): ComicScraperSession {
  const loaders = createMangaLoaders(runtime, mangaId, ctx, signal)
  const tasks = new Map<ComicScraperSlot, Promise<unknown>>()

  const loadSlot = async (slot: ComicScraperSlot): Promise<unknown> => {
    switch (slot) {
      case 'info':
        return buildComicInfo(await loaders.getDetail(), ctx)
      case 'tags':
        return buildTags(await loaders.getDetail())
      case 'persons':
        return buildAuthorFacts(await loaders.getDetail(), 'comic')
      case 'companies':
        return buildSerializationFacts(await loaders.getDetail())
      case 'relatedEntries':
        return buildRelatedEntries(await loaders.getDetail())
      case 'covers':
        return buildCovers(await loaders.getDetail())
      case 'characters':
        return buildCharacterFacts(await loaders.getCharacters())
      case 'chapters':
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

      return { identity: buildIdentity(mangaId), slots: output }
    }
  }
}

export function createMalNovelSession(
  runtime: MalRuntime,
  mangaId: number,
  ctx: MediaSessionContext,
  signal: AbortSignal
): NovelScraperSession {
  const loaders = createMangaLoaders(runtime, mangaId, ctx, signal)
  const tasks = new Map<NovelScraperSlot, Promise<unknown>>()

  const loadSlot = async (slot: NovelScraperSlot): Promise<unknown> => {
    switch (slot) {
      case 'info':
        return buildNovelInfo(await loaders.getDetail(), ctx)
      case 'tags':
        return buildTags(await loaders.getDetail())
      case 'persons':
        return buildAuthorFacts(await loaders.getDetail(), 'novel')
      case 'companies':
        return buildSerializationFacts(await loaders.getDetail())
      case 'relatedEntries':
        return buildRelatedEntries(await loaders.getDetail())
      case 'covers':
        return buildCovers(await loaders.getDetail())
      case 'characters':
        return buildCharacterFacts(await loaders.getCharacters())
      case 'volumes':
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

      return { identity: buildIdentity(mangaId), slots: output }
    }
  }
}

interface MangaLoaders {
  getDetail(): Promise<MalMangaDetail>
  getCharacters(): Promise<MirrorCharacterEdge[] | undefined>
}

function createMangaLoaders(
  runtime: MalRuntime,
  mangaId: number,
  ctx: MediaSessionContext,
  signal: AbortSignal
): MangaLoaders {
  return {
    getDetail: memoize(() => runtime.official.getManga(mangaId, { signal })),
    getCharacters: memoize(() =>
      loadMirrorSlot(runtime, ctx, () => runtime.mirror.getMangaCharacters(mangaId, { signal }))
    )
  }
}

/**
 * Mirror reads degrade to slot absence: `undefined` when the mirror is off,
 * unreachable, or does not know the entry.
 */
async function loadMirrorSlot<T>(
  runtime: MalRuntime,
  ctx: MediaSessionContext,
  load: () => Promise<T>
): Promise<T | undefined> {
  if (!(await runtime.mirror.isEnabled())) {
    return undefined
  }

  try {
    return await load()
  } catch (error) {
    if (isCancellationError(error)) {
      throw error
    }
    ctx.logger.debug('MAL mirror slot skipped.', toSafeErrorLog(error))
    return undefined
  }
}

function buildIdentity(id: number): ScrapedEntityIdentity {
  return { externalIds: [toMalExternalId(id)] }
}

interface InfoCore {
  name: string
  originalName?: string | undefined
  aliases?: string[] | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  externalSites?: ExternalSite[] | undefined
}

function buildInfoCore(
  detail: MalAnimeDetail | MalMangaDetail,
  kind: MalMediaKind,
  ctx: MediaSessionContext
): InfoCore | undefined {
  const titles = selectMalTitles(detail.title, detail.alternative_titles, ctx)
  if (!titles) {
    return undefined
  }

  const externalSites: ExternalSite[] = [malEntrySite(kind, detail.id)]
  return {
    name: titles.name,
    originalName: titles.originalName,
    aliases: titles.aliases,
    releaseDate: parseMalDate(detail.start_date),
    description: normalizeSynopsis(detail.synopsis),
    externalSites
  }
}

function buildAnimeInfo(
  detail: MalAnimeDetail,
  ctx: MediaSessionContext
): ScrapedAnimeInfo | undefined {
  const core = buildInfoCore(detail, 'anime', ctx)
  if (!core) {
    return undefined
  }

  return {
    ...core,
    format: mapAnimeFormat(detail.media_type),
    totalEpisodes: readCount(detail.num_episodes)
  }
}

function buildComicInfo(
  detail: MalMangaDetail,
  ctx: MediaSessionContext
): ScrapedComicInfo | undefined {
  const core = buildInfoCore(detail, 'comic', ctx)
  if (!core) {
    return undefined
  }

  return {
    ...core,
    format: mapComicFormat(detail.media_type),
    totalVolumes: readCount(detail.num_volumes),
    totalChapters: readCount(detail.num_chapters)
  }
}

function buildNovelInfo(
  detail: MalMangaDetail,
  ctx: MediaSessionContext
): ScrapedNovelInfo | undefined {
  const core = buildInfoCore(detail, 'novel', ctx)
  if (!core) {
    return undefined
  }

  return {
    ...core,
    format: mapNovelFormat(detail.media_type),
    totalVolumes: readCount(detail.num_volumes)
  }
}

function buildTags(detail: MalAnimeDetail | MalMangaDetail): ScrapedTag[] {
  const tags: ScrapedTag[] = []
  const seen = new Set<string>()

  for (const genre of detail.genres ?? []) {
    const name = trimToUndefined(genre?.name)
    if (name && !seen.has(name)) {
      seen.add(name)
      tags.push({ name })
    }
  }

  return tags
}

function buildStudios(detail: MalAnimeDetail) {
  const facts: (ScrapedCompanyMetadata & { role: 'studio' })[] = []

  for (const studio of detail.studios ?? []) {
    const name = trimToUndefined(studio?.name)
    if (!name) {
      continue
    }

    facts.push({
      name,
      identity: { externalIds: [{ source: MAL_SOURCE_ID, id: String(studio.id) }] },
      role: 'studio'
    })
  }

  return facts
}

/** Serialization magazines are company facts without a closer role than `other`. */
function buildSerializationFacts(detail: MalMangaDetail) {
  const facts: (ScrapedCompanyMetadata & { role: 'other'; note: string })[] = []

  for (const edge of detail.serialization ?? []) {
    const name = trimToUndefined(edge?.node?.name)
    const id = edge?.node?.id
    if (!name || typeof id !== 'number') {
      continue
    }

    facts.push({
      name,
      identity: { externalIds: [{ source: MAL_SOURCE_ID, id: String(id) }] },
      role: 'other',
      note: 'Serialization'
    })
  }

  return facts
}

function buildAuthorFacts(detail: MalMangaDetail, kind: 'comic' | 'novel') {
  const facts: (ScrapedPersonMetadata & { role: string; note?: string | undefined })[] = []

  for (const edge of detail.authors ?? []) {
    const fact = toAuthorFact(edge, kind)
    if (fact) {
      facts.push(fact)
    }
  }

  return facts
}

function toAuthorFact(edge: MalAuthorEdge, kind: 'comic' | 'novel') {
  const node = edge.node
  if (!node) {
    return undefined
  }

  const first = trimToUndefined(node.first_name)
  const last = trimToUndefined(node.last_name)
  const name = [first, last].filter(Boolean).join(' ')
  if (!name) {
    return undefined
  }

  const role = kind === 'comic' ? mapComicAuthorRole(edge.role) : mapNovelAuthorRole(edge.role)
  const note = trimToUndefined(edge.role)

  return {
    name,
    identity: { externalIds: [toMalExternalId(node.id)] },
    role,
    note
  }
}

function buildRelatedEntries(detail: MalAnimeDetail | MalMangaDetail): ScrapedRelatedEntryFact[] {
  const facts: ScrapedRelatedEntryFact[] = []

  const push = (edge: MalRelatedEdge, mediaType: MalMediaKind): void => {
    const node = edge.node
    const type = mapRelationType(edge.relation_type)
    if (!node || !type) {
      return
    }

    facts.push({
      mediaType,
      source: MAL_SOURCE_ID,
      externalId: String(node.id),
      type
    })
  }

  for (const edge of detail.related_anime ?? []) {
    push(edge, 'anime')
  }
  for (const edge of detail.related_manga ?? []) {
    push(edge, resolveMangaKind(edge.node?.media_type))
  }

  return facts
}

/** The poster plus MAL's picture variants; MAL states no landscape art. */
function buildCovers(detail: MalAnimeDetail | MalMangaDetail): string[] {
  return dedupeUrls([
    detail.main_picture?.large ?? detail.main_picture?.medium,
    ...(detail.pictures ?? []).map((picture) => picture?.large ?? picture?.medium)
  ])
}

function buildCharacterFacts(edges: MirrorCharacterEdge[] | undefined) {
  if (edges === undefined) {
    return undefined
  }

  return edges.map(toCharacterFact).filter((fact) => fact !== undefined)
}

function buildStaffFacts(edges: MirrorStaffEdge[] | undefined) {
  if (edges === undefined) {
    return undefined
  }

  return edges.map(toStaffFact).filter((fact) => fact !== undefined)
}

function buildEpisodes(episodes: MirrorEpisode[] | undefined): ScrapedAnimeEpisode[] | undefined {
  if (episodes === undefined) {
    return undefined
  }

  const facts: ScrapedAnimeEpisode[] = []
  for (const episode of episodes) {
    if (!Number.isInteger(episode.mal_id) || episode.mal_id <= 0) {
      continue
    }

    facts.push({
      number: episode.mal_id,
      type: 'regular' as const,
      name: trimToUndefined(episode.title),
      originalName: trimToUndefined(episode.title_japanese),
      airDate: parseMirrorAired(episode.aired),
      durationMs:
        typeof episode.duration === 'number' && episode.duration > 0
          ? Math.trunc(episode.duration * 1000)
          : undefined
    })
  }

  return facts
}

function readCount(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
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
