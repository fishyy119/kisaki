/**
 * Comic data composable
 *
 * The provider/consumer shell (route loader, dialog provider, db sync) comes
 * from the entity detail context factory; this module owns what a comic
 * detail surface fetches and shows.
 */

import { eq, asc, desc, and, inArray } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import type {
  Comic,
  ComicChapter,
  ComicChapterFile,
  ComicNote,
  ComicSession,
  ComicCharacterLink,
  ComicPersonLink,
  ComicCompanyLink,
  ComicTagLink,
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

/** One readable unit with the container files it owns, ordered by preference. */
export interface ComicChapterEntry extends ComicChapter {
  files: ComicChapterFile[]
}

export interface ComicData {
  comic: Comic | null
  chapters: ComicChapterEntry[]
  notes: ComicNote[]
  tags: (ComicTagLink & { tag: Tag | null })[]
  characters: (ComicCharacterLink & { character: Character | null })[]
  persons: (ComicPersonLink & { person: Person | null })[]
  companies: (ComicCompanyLink & { company: Company | null })[]
  relations: MediaRelationEntry[]
  sessions: ComicSession[]
}

export type ComicContext = EntityDetailContext<ComicData>
export type ComicProviderReturn = EntityDetailProviderReturn<ComicData>

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchComicData(
  comicId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<ComicData | null> {
  if (!comicId) return null

  const comicWhere = and(
    eq(schema.comics.id, comicId),
    showNsfw ? undefined : eq(schema.comics.isNsfw, false)
  )
  const [comicData] = await db.select().from(schema.comics).where(comicWhere).limit(1)

  if (!comicData) return null

  const comicTagLinksWhere = and(
    eq(schema.comicTagLinks.comicId, comicId),
    spoilersRevealed ? undefined : eq(schema.comicTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const comicCharacterLinksWhere = and(
    eq(schema.comicCharacterLinks.comicId, comicId),
    spoilersRevealed ? undefined : eq(schema.comicCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  const comicPersonLinksWhere = and(
    eq(schema.comicPersonLinks.comicId, comicId),
    spoilersRevealed ? undefined : eq(schema.comicPersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  const comicCompanyLinksWhere = and(
    eq(schema.comicCompanyLinks.comicId, comicId),
    spoilersRevealed ? undefined : eq(schema.comicCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.companies.isNsfw, false)
  )

  const [chapters, notes, tagLinks, charLinks, personLinks, companyLinks, relations, sessions] =
    await Promise.all([
      db
        .select()
        .from(schema.comicChapters)
        .where(eq(schema.comicChapters.comicId, comicId))
        .orderBy(
          asc(schema.comicChapters.orderInComic),
          asc(schema.comicChapters.volumeNumber),
          asc(schema.comicChapters.chapterNumber)
        ),
      db
        .select()
        .from(schema.comicNotes)
        .where(eq(schema.comicNotes.comicId, comicId))
        .orderBy(asc(schema.comicNotes.orderInComic), asc(schema.comicNotes.name)),
      db
        .select()
        .from(schema.comicTagLinks)
        .leftJoin(schema.tags, eq(schema.comicTagLinks.tagId, schema.tags.id))
        .where(comicTagLinksWhere)
        .orderBy(asc(schema.comicTagLinks.orderInComic)),
      db
        .select()
        .from(schema.comicCharacterLinks)
        .leftJoin(
          schema.characters,
          eq(schema.comicCharacterLinks.characterId, schema.characters.id)
        )
        .where(comicCharacterLinksWhere)
        .orderBy(asc(schema.comicCharacterLinks.orderInComic)),
      db
        .select()
        .from(schema.comicPersonLinks)
        .leftJoin(schema.persons, eq(schema.comicPersonLinks.personId, schema.persons.id))
        .where(comicPersonLinksWhere)
        .orderBy(asc(schema.comicPersonLinks.orderInComic)),
      db
        .select()
        .from(schema.comicCompanyLinks)
        .leftJoin(schema.companies, eq(schema.comicCompanyLinks.companyId, schema.companies.id))
        .where(comicCompanyLinksWhere)
        .orderBy(asc(schema.comicCompanyLinks.orderInComic)),
      fetchMediaRelations('comic', comicId, showNsfw),
      db
        .select()
        .from(schema.comicSessions)
        .where(eq(schema.comicSessions.comicId, comicId))
        .orderBy(desc(schema.comicSessions.startedAt))
    ])

  return {
    comic: comicData,
    chapters: await attachChapterFiles(chapters),
    notes,
    tags: tagLinks.map((row) => ({ ...row.comic_tag_links, tag: row.tags })),
    characters: charLinks.map((row) => ({
      ...row.comic_character_links,
      character: row.characters
    })),
    persons: personLinks.map((row) => ({ ...row.comic_person_links, person: row.persons })),
    companies: companyLinks.map((row) => ({
      ...row.comic_company_links,
      company: row.companies
    })),
    relations,
    sessions
  }
}

/** Files are loaded in one query and grouped in memory to keep unit order stable. */
async function attachChapterFiles(chapters: ComicChapter[]): Promise<ComicChapterEntry[]> {
  if (chapters.length === 0) return []

  const files = await db
    .select()
    .from(schema.comicChapterFiles)
    .where(
      inArray(
        schema.comicChapterFiles.chapterId,
        chapters.map((chapter) => chapter.id)
      )
    )
    .orderBy(desc(schema.comicChapterFiles.isPrimary), asc(schema.comicChapterFiles.createdAt))

  const filesByChapter = new Map<string, ComicChapterFile[]>()
  for (const file of files) {
    const bucket = filesByChapter.get(file.chapterId)
    if (bucket) {
      bucket.push(file)
    } else {
      filesByChapter.set(file.chapterId, [file])
    }
  }

  return chapters.map((chapter) => ({ ...chapter, files: filesByChapter.get(chapter.id) ?? [] }))
}

// =============================================================================
// Context Wiring
// =============================================================================

const COMIC_OWNED_TABLES = [
  'comic_chapters',
  'comic_chapter_files',
  'comic_notes',
  'comic_sessions',
  'comic_tag_links',
  'comic_character_links',
  'comic_person_links',
  'comic_company_links',
  'media_relations'
]

const comicDetail = createEntityDetailContext<ComicData>({
  entityType: 'comic',
  empty: {
    comic: null,
    chapters: [],
    notes: [],
    tags: [],
    characters: [],
    persons: [],
    companies: [],
    relations: [],
    sessions: []
  },
  fetch: (id, view) => fetchComicData(id, view.spoilersRevealed, view.showNsfw),
  ownedTables: COMIC_OWNED_TABLES,
  entityTable: 'comics'
})

export const comicDetailData = comicDetail.detailData
export const useComicRouteProvider = comicDetail.useRouteProvider
export const useComicDialogProvider = comicDetail.useDialogProvider
export const useComic = comicDetail.useContext
