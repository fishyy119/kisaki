/**
 * Media sessions for the three kinds AniList serves.
 *
 * The kinds share one Media entity, so the builders are common and each kind
 * only shapes its own info payload and person-role vocabulary. Slots AniList
 * cannot answer (episodes, chapters, volumes, logos, and manga companies)
 * are omitted rather than returned empty.
 */

import type {
  AnimeScraperSession,
  AnimeScraperSlot,
  AnimeSessionResultMap,
  ComicScraperSession,
  ComicScraperSlot,
  ComicSessionResultMap,
  ContentLocale,
  NovelScraperSession,
  NovelScraperSlot,
  NovelSessionResultMap,
  PartialDate,
  ScrapedAnimeCharacterFact,
  ScrapedAnimeCompanyFact,
  ScrapedAnimeInfo,
  ScrapedComicInfo,
  ExternalSite,
  ScrapedEntityIdentity,
  ScrapedNovelInfo,
  ScrapedPersonMetadata,
  ScrapedRelatedEntryFact,
  ScrapedTag
} from '@kisaki3/extension-sdk'
import type { AnilistClient } from '../api/client'
import type { AnilistMedia } from '../api/types'
import type { AnilistSettingsV1 } from '../config/schema'
import { ANILIST_SOURCE_ID } from '../utils/constants'
import { parseFuzzyDate } from './format/dates'
import { selectMediaTitles } from './format/names'
import {
  mapAnimePersonRole,
  mapCharacterRole,
  mapComicPersonRole,
  mapNovelPersonRole,
  mapRelationType
} from './format/roles'
import {
  anilistSite,
  buildMediaExternalIds,
  dedupeExternalSites,
  dedupeUrls,
  externalLinkSite,
  toOptionalSites
} from './format/sites'
import { normalizeDescription, trimToUndefined } from './format/text'
import { mapAnimeFormat, mapComicFormat, mapNovelFormat, resolveMediaKind } from './kinds'
import { createMediaLoaders, type AnilistMediaLoaders } from './loaders'
import { toCharacterMetadata, toPersonMetadata, toVoiceActorFact } from './satellites'

export interface MediaSessionContext {
  locale: ContentLocale
  preferRomaji: boolean
}

export function createSessionContext(
  settings: AnilistSettingsV1,
  locale: ContentLocale
): MediaSessionContext {
  return { locale, preferRomaji: settings.naming.preferRomajiTitles }
}

export function createAnilistAnimeSession(
  client: AnilistClient,
  mediaId: number,
  ctx: MediaSessionContext,
  signal: AbortSignal
): AnimeScraperSession {
  const loaders = createMediaLoaders(client, mediaId, signal)
  const tasks = new Map<AnimeScraperSlot, Promise<unknown>>()

  const loadSlot = (slot: AnimeScraperSlot): Promise<unknown> => {
    switch (slot) {
      case 'info':
        return buildAnimeInfo(loaders, ctx)
      case 'tags':
        return loaders.getMedia().then(buildTags)
      case 'characters':
        return buildCharacters(loaders, ctx)
      case 'persons':
        return buildPersons(loaders, ctx, mapAnimePersonRole)
      case 'companies':
        return buildStudios(loaders, ctx)
      case 'relatedEntries':
        return loaders.getMedia().then(buildRelatedEntries)
      case 'covers':
        return loaders.getMedia().then(buildCovers)
      case 'backdrops':
        return loaders.getMedia().then(buildBackdrops)
      case 'episodes':
      case 'logos':
        return Promise.resolve(undefined)
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

      return { identity: await buildIdentity(loaders), slots: output }
    }
  }
}

export function createAnilistComicSession(
  client: AnilistClient,
  mediaId: number,
  ctx: MediaSessionContext,
  signal: AbortSignal
): ComicScraperSession {
  const loaders = createMediaLoaders(client, mediaId, signal)
  const tasks = new Map<ComicScraperSlot, Promise<unknown>>()

  const loadSlot = (slot: ComicScraperSlot): Promise<unknown> => {
    switch (slot) {
      case 'info':
        return buildComicInfo(loaders, ctx)
      case 'tags':
        return loaders.getMedia().then(buildTags)
      case 'characters':
        return buildCharacters(loaders, ctx)
      case 'persons':
        return buildPersons(loaders, ctx, mapComicPersonRole)
      case 'relatedEntries':
        return loaders.getMedia().then(buildRelatedEntries)
      case 'covers':
        return loaders.getMedia().then(buildCovers)
      case 'backdrops':
        return loaders.getMedia().then(buildBackdrops)
      case 'chapters':
      case 'companies':
      case 'logos':
        return Promise.resolve(undefined)
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

      return { identity: await buildIdentity(loaders), slots: output }
    }
  }
}

export function createAnilistNovelSession(
  client: AnilistClient,
  mediaId: number,
  ctx: MediaSessionContext,
  signal: AbortSignal
): NovelScraperSession {
  const loaders = createMediaLoaders(client, mediaId, signal)
  const tasks = new Map<NovelScraperSlot, Promise<unknown>>()

  const loadSlot = (slot: NovelScraperSlot): Promise<unknown> => {
    switch (slot) {
      case 'info':
        return buildNovelInfo(loaders, ctx)
      case 'tags':
        return loaders.getMedia().then(buildTags)
      case 'characters':
        return buildCharacters(loaders, ctx)
      case 'persons':
        return buildPersons(loaders, ctx, mapNovelPersonRole)
      case 'relatedEntries':
        return loaders.getMedia().then(buildRelatedEntries)
      case 'covers':
        return loaders.getMedia().then(buildCovers)
      case 'backdrops':
        return loaders.getMedia().then(buildBackdrops)
      case 'volumes':
      case 'companies':
      case 'logos':
        return Promise.resolve(undefined)
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

      return { identity: await buildIdentity(loaders), slots: output }
    }
  }
}

async function buildIdentity(loaders: AnilistMediaLoaders): Promise<ScrapedEntityIdentity> {
  const media = await loaders.getMedia()
  return { externalIds: buildMediaExternalIds(media.id, media.idMal) }
}

interface InfoCore {
  name: string
  originalName?: string | undefined
  aliases?: string[] | undefined
  releaseDate?: PartialDate | undefined
  description?: string | undefined
  externalSites?: ExternalSite[] | undefined
}

async function buildInfoCore(
  loaders: AnilistMediaLoaders,
  ctx: MediaSessionContext
): Promise<{ media: AnilistMedia; core: InfoCore } | undefined> {
  const media = await loaders.getMedia()
  const titles = selectMediaTitles(media.title, media.synonyms, ctx)
  if (!titles) {
    return undefined
  }

  const sites = dedupeExternalSites([
    anilistSite(media.siteUrl),
    ...(media.externalLinks ?? []).map(externalLinkSite)
  ])

  return {
    media,
    core: {
      name: titles.name,
      originalName: titles.originalName,
      aliases: titles.aliases,
      releaseDate: parseFuzzyDate(media.startDate),
      description: normalizeDescription(media.description),
      externalSites: toOptionalSites(sites)
    }
  }
}

async function buildAnimeInfo(
  loaders: AnilistMediaLoaders,
  ctx: MediaSessionContext
): Promise<ScrapedAnimeInfo | undefined> {
  const built = await buildInfoCore(loaders, ctx)
  if (!built) {
    return undefined
  }

  return {
    ...built.core,
    format: mapAnimeFormat(built.media.format),
    totalEpisodes: readCount(built.media.episodes)
  }
}

async function buildComicInfo(
  loaders: AnilistMediaLoaders,
  ctx: MediaSessionContext
): Promise<ScrapedComicInfo | undefined> {
  const built = await buildInfoCore(loaders, ctx)
  if (!built) {
    return undefined
  }

  return {
    ...built.core,
    format: mapComicFormat(built.media.countryOfOrigin),
    totalVolumes: readCount(built.media.volumes),
    totalChapters: readCount(built.media.chapters)
  }
}

async function buildNovelInfo(
  loaders: AnilistMediaLoaders,
  ctx: MediaSessionContext
): Promise<ScrapedNovelInfo | undefined> {
  const built = await buildInfoCore(loaders, ctx)
  if (!built) {
    return undefined
  }

  return {
    ...built.core,
    format: mapNovelFormat(),
    totalVolumes: readCount(built.media.volumes)
  }
}

/** Genres are AniList's own vocabulary; tags are community facts with flags. */
function buildTags(media: AnilistMedia): ScrapedTag[] {
  const tags: ScrapedTag[] = []
  const seen = new Set<string>()

  for (const genre of media.genres ?? []) {
    const name = trimToUndefined(genre)
    if (name && !seen.has(name)) {
      seen.add(name)
      tags.push({ name })
    }
  }

  for (const tag of media.tags ?? []) {
    const name = trimToUndefined(tag?.name)
    if (!name || seen.has(name)) {
      continue
    }
    seen.add(name)
    tags.push({
      name,
      isSpoiler: tag?.isMediaSpoiler === true ? true : undefined,
      isNsfw: tag?.isAdult === true ? true : undefined
    })
  }

  return tags
}

async function buildCharacters(
  loaders: AnilistMediaLoaders,
  ctx: MediaSessionContext
): Promise<ScrapedAnimeCharacterFact[]> {
  const edges = await loaders.getCharacterEdges()
  const facts: ScrapedAnimeCharacterFact[] = []

  for (const edge of edges) {
    if (!edge.node) {
      continue
    }

    const metadata = toCharacterMetadata(edge.node, ctx)
    if (!metadata) {
      continue
    }

    const voiceActors = (edge.voiceActors ?? [])
      .map((actor) => toVoiceActorFact(actor, ctx))
      .filter((fact) => fact !== undefined)

    facts.push({
      ...metadata,
      persons: voiceActors.length > 0 ? voiceActors : metadata.persons,
      role: mapCharacterRole(edge.role)
    })
  }

  return facts
}

async function buildPersons<TRole extends string>(
  loaders: AnilistMediaLoaders,
  ctx: MediaSessionContext,
  mapRole: (role: string) => TRole
): Promise<(ScrapedPersonMetadata & { role: TRole; note?: string })[]> {
  const edges = await loaders.getStaffEdges()
  const facts: (ScrapedPersonMetadata & { role: TRole; note?: string })[] = []

  for (const edge of edges) {
    if (!edge.node) {
      continue
    }

    const metadata = toPersonMetadata(edge.node, ctx)
    if (!metadata) {
      continue
    }

    const roleText = trimToUndefined(edge.role)
    facts.push({
      ...metadata,
      role: mapRole(roleText ?? ''),
      ...(roleText !== undefined ? { note: roleText } : {})
    })
  }

  return facts
}

/** Studios only exist for anime; `isMain` separates studio from producer credits. */
async function buildStudios(
  loaders: AnilistMediaLoaders,
  _ctx: MediaSessionContext
): Promise<ScrapedAnimeCompanyFact[]> {
  const media = await loaders.getMedia()
  const facts: ScrapedAnimeCompanyFact[] = []

  for (const edge of media.studios?.edges ?? []) {
    const name = trimToUndefined(edge?.node?.name)
    const id = edge?.node?.id
    if (!name || typeof id !== 'number') {
      continue
    }

    facts.push({
      name,
      identity: { externalIds: [{ source: ANILIST_SOURCE_ID, id: String(id) }] },
      role: edge?.isMain ? 'studio' : 'producer'
    })
  }

  return facts
}

function buildRelatedEntries(media: AnilistMedia): ScrapedRelatedEntryFact[] {
  const facts: ScrapedRelatedEntryFact[] = []

  for (const edge of media.relations?.edges ?? []) {
    const node = edge?.node
    if (!node) {
      continue
    }

    const kind = resolveMediaKind(node.type, node.format)
    const type = mapRelationType(edge.relationType)
    if (!kind || !type) {
      continue
    }

    facts.push({
      mediaType: kind,
      source: ANILIST_SOURCE_ID,
      externalId: String(node.id),
      type
    })
  }

  return facts
}

function buildCovers(media: AnilistMedia): string[] {
  return dedupeUrls([media.coverImage?.extraLarge ?? media.coverImage?.large])
}

function buildBackdrops(media: AnilistMedia): string[] {
  return dedupeUrls([media.bannerImage])
}

function readCount(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}
