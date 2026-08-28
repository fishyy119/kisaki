/**
 * Anime data composable
 *
 * The provider/consumer shell (route loader, dialog provider, db sync) comes
 * from the entity detail context factory; this module owns what an anime
 * detail surface fetches and shows.
 */

import { eq, asc, desc, and, inArray } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import type {
  Anime,
  AnimeEpisode,
  AnimeEpisodeFile,
  AnimeExtra,
  AnimeExtraFile,
  AnimeNote,
  AnimeSession,
  AnimeCastLink,
  AnimeCharacterLink,
  AnimePersonLink,
  AnimeCompanyLink,
  AnimeTagLink,
  Character,
  Person,
  Company,
  Tag
} from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import { fetchMediaRelations, type MediaRelationEntry } from '@renderer/core/db/media-relations'
import {
  createEntityDetailContext,
  type EntityDetailContext,
  type EntityDetailProviderReturn
} from './entity-context'

// =============================================================================
// Types
// =============================================================================

/** One episode with the playable files it owns, ordered by preference. */
export interface AnimeEpisodeEntry extends AnimeEpisode {
  files: AnimeEpisodeFile[]
}

/** One extra with the playable files it owns, ordered by preference. */
export interface AnimeExtraEntry extends AnimeExtra {
  files: AnimeExtraFile[]
}

export interface AnimeData {
  anime: Anime | null
  episodes: AnimeEpisodeEntry[]
  extras: AnimeExtraEntry[]
  notes: AnimeNote[]
  tags: (AnimeTagLink & { tag: Tag | null })[]
  characters: (AnimeCharacterLink & { character: Character | null })[]
  persons: (AnimePersonLink & { person: Person | null })[]
  cast: AnimeCastEntry[]
  companies: (AnimeCompanyLink & { company: Company | null })[]
  relations: MediaRelationEntry[]
  sessions: AnimeSession[]
}

/**
 * One confirmed voice credit of this entry: who voices whom, here.
 *
 * Both endpoints travel with the row because the pairing is the fact; a
 * character link and a person link on their own cannot be joined back into it.
 */
export interface AnimeCastEntry extends AnimeCastLink {
  character: Character | null
  person: Person | null
}

export type AnimeContext = EntityDetailContext<AnimeData>
export type AnimeProviderReturn = EntityDetailProviderReturn<AnimeData>

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchAnimeData(
  animeId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<AnimeData | null> {
  if (!animeId) return null

  const animeWhere = and(
    eq(schema.animes.id, animeId),
    showNsfw ? undefined : eq(schema.animes.isNsfw, false)
  )
  const [animeData] = await db.select().from(schema.animes).where(animeWhere).limit(1)

  if (!animeData) return null

  const animeTagLinksWhere = and(
    eq(schema.animeTagLinks.animeId, animeId),
    spoilersRevealed ? undefined : eq(schema.animeTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const animeCharacterLinksWhere = and(
    eq(schema.animeCharacterLinks.animeId, animeId),
    spoilersRevealed ? undefined : eq(schema.animeCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  const animePersonLinksWhere = and(
    eq(schema.animePersonLinks.animeId, animeId),
    spoilersRevealed ? undefined : eq(schema.animePersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  // A cast row names both endpoints, so either being hidden hides the credit.
  const animeCastLinksWhere = and(
    eq(schema.animeCastLinks.animeId, animeId),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  const animeCompanyLinksWhere = and(
    eq(schema.animeCompanyLinks.animeId, animeId),
    spoilersRevealed ? undefined : eq(schema.animeCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.companies.isNsfw, false)
  )

  const [
    episodes,
    extras,
    notes,
    tagLinks,
    charLinks,
    personLinks,
    castLinks,
    companyLinks,
    relations,
    sessions
  ] = await Promise.all([
    db
      .select()
      .from(schema.animeEpisodes)
      .where(eq(schema.animeEpisodes.animeId, animeId))
      .orderBy(asc(schema.animeEpisodes.orderInAnime), asc(schema.animeEpisodes.episodeNumber)),
    db
      .select()
      .from(schema.animeExtras)
      .where(eq(schema.animeExtras.animeId, animeId))
      .orderBy(asc(schema.animeExtras.orderInAnime), asc(schema.animeExtras.name)),
    db
      .select()
      .from(schema.animeNotes)
      .where(eq(schema.animeNotes.animeId, animeId))
      .orderBy(asc(schema.animeNotes.orderInAnime), asc(schema.animeNotes.name)),
    db
      .select()
      .from(schema.animeTagLinks)
      .leftJoin(schema.tags, eq(schema.animeTagLinks.tagId, schema.tags.id))
      .where(animeTagLinksWhere)
      .orderBy(asc(schema.animeTagLinks.orderInAnime)),
    db
      .select()
      .from(schema.animeCharacterLinks)
      .leftJoin(schema.characters, eq(schema.animeCharacterLinks.characterId, schema.characters.id))
      .where(animeCharacterLinksWhere)
      .orderBy(asc(schema.animeCharacterLinks.orderInAnime)),
    db
      .select()
      .from(schema.animePersonLinks)
      .leftJoin(schema.persons, eq(schema.animePersonLinks.personId, schema.persons.id))
      .where(animePersonLinksWhere)
      .orderBy(asc(schema.animePersonLinks.orderInAnime)),
    db
      .select()
      .from(schema.animeCastLinks)
      .leftJoin(schema.characters, eq(schema.animeCastLinks.characterId, schema.characters.id))
      .leftJoin(schema.persons, eq(schema.animeCastLinks.personId, schema.persons.id))
      .where(animeCastLinksWhere),
    db
      .select()
      .from(schema.animeCompanyLinks)
      .leftJoin(schema.companies, eq(schema.animeCompanyLinks.companyId, schema.companies.id))
      .where(animeCompanyLinksWhere)
      .orderBy(asc(schema.animeCompanyLinks.orderInAnime)),
    fetchMediaRelations('anime', animeId, showNsfw),
    db
      .select()
      .from(schema.animeSessions)
      .where(eq(schema.animeSessions.animeId, animeId))
      .orderBy(desc(schema.animeSessions.startedAt))
  ])

  return {
    anime: animeData,
    episodes: await attachEpisodeFiles(episodes),
    extras: await attachExtraFiles(extras),
    notes,
    tags: tagLinks.map((row) => ({ ...row.anime_tag_links, tag: row.tags })),
    characters: charLinks.map((row) => ({
      ...row.anime_character_links,
      character: row.characters
    })),
    persons: personLinks.map((row) => ({ ...row.anime_person_links, person: row.persons })),
    cast: castLinks.map((row) => ({
      ...row.anime_cast_links,
      character: row.characters,
      person: row.persons
    })),
    companies: companyLinks.map((row) => ({
      ...row.anime_company_links,
      company: row.companies
    })),
    relations,
    sessions
  }
}

/** Files are loaded in one query and grouped in memory to keep episode order stable. */
async function attachEpisodeFiles(episodes: AnimeEpisode[]): Promise<AnimeEpisodeEntry[]> {
  if (episodes.length === 0) return []

  const files = await db
    .select()
    .from(schema.animeEpisodeFiles)
    .where(
      inArray(
        schema.animeEpisodeFiles.episodeId,
        episodes.map((episode) => episode.id)
      )
    )
    .orderBy(desc(schema.animeEpisodeFiles.isPrimary), asc(schema.animeEpisodeFiles.createdAt))

  const filesByEpisode = new Map<string, AnimeEpisodeFile[]>()
  for (const file of files) {
    const bucket = filesByEpisode.get(file.episodeId)
    if (bucket) {
      bucket.push(file)
    } else {
      filesByEpisode.set(file.episodeId, [file])
    }
  }

  return episodes.map((episode) => ({ ...episode, files: filesByEpisode.get(episode.id) ?? [] }))
}

/** Extra files load in one query, primary first, mirroring the episode files. */
async function attachExtraFiles(extras: AnimeExtra[]): Promise<AnimeExtraEntry[]> {
  if (extras.length === 0) return []

  const files = await db
    .select()
    .from(schema.animeExtraFiles)
    .where(
      inArray(
        schema.animeExtraFiles.extraId,
        extras.map((extra) => extra.id)
      )
    )
    .orderBy(desc(schema.animeExtraFiles.isPrimary), asc(schema.animeExtraFiles.createdAt))

  const filesByExtra = new Map<string, AnimeExtraFile[]>()
  for (const file of files) {
    const bucket = filesByExtra.get(file.extraId)
    if (bucket) {
      bucket.push(file)
    } else {
      filesByExtra.set(file.extraId, [file])
    }
  }

  return extras.map((extra) => ({ ...extra, files: filesByExtra.get(extra.id) ?? [] }))
}

// =============================================================================
// Context Wiring
// =============================================================================

const ANIME_OWNED_TABLES = [
  'anime_episodes',
  'anime_episode_files',
  'anime_extras',
  'anime_extra_files',
  'anime_notes',
  'anime_sessions',
  'anime_tag_links',
  'anime_character_links',
  'anime_person_links',
  'anime_cast_links',
  'anime_company_links',
  'media_relations'
]

const animeDetail = createEntityDetailContext<AnimeData>({
  entityType: 'anime',
  empty: {
    anime: null,
    episodes: [],
    extras: [],
    notes: [],
    tags: [],
    characters: [],
    persons: [],
    cast: [],
    companies: [],
    relations: [],
    sessions: []
  },
  fetch: (id, view) => fetchAnimeData(id, view.spoilersRevealed, view.showNsfw),
  ownedTables: ANIME_OWNED_TABLES,
  entityTable: 'animes'
})

export const animeDetailData = animeDetail.detailData
export const useAnimeRouteProvider = animeDetail.useRouteProvider
export const useAnimeDialogProvider = animeDetail.useDialogProvider
export const useAnime = animeDetail.useContext
