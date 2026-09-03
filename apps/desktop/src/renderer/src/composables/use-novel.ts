/**
 * Novel data composable
 *
 * The provider/consumer shell (route query, dialog provider, invalidation) comes
 * from the entity detail context factory; this module owns what a novel
 * detail surface fetches and shows.
 */

import { eq, asc, desc, and, inArray } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import type {
  Novel,
  NovelVolume,
  NovelVolumeFile,
  NovelNote,
  NovelSession,
  NovelCharacterLink,
  NovelPersonLink,
  NovelCompanyLink,
  NovelTagLink,
  Character,
  Person,
  Company,
  Tag
} from '@shared/db/schema'
import * as schema from '@shared/db/schema'
import type { TableName } from '@shared/db/table-names'
import {
  MEDIA_RELATION_TABLES,
  fetchMediaRelations,
  type MediaRelationEntry
} from '@renderer/core/db/media-relations'
import {
  createEntityDetailContext,
  createEntitySpoilerParams,
  type EntityDetailContext,
  type EntityDetailProviderReturn,
  type EntitySpoilerParams
} from './entity-context'

// =============================================================================
// Types
// =============================================================================

/** One volume with the readable files it owns, ordered by preference. */
export interface NovelVolumeEntry extends NovelVolume {
  files: NovelVolumeFile[]
}

export interface NovelData {
  novel: Novel | null
  volumes: NovelVolumeEntry[]
  notes: NovelNote[]
  tags: (NovelTagLink & { tag: Tag | null })[]
  characters: (NovelCharacterLink & { character: Character | null })[]
  persons: (NovelPersonLink & { person: Person | null })[]
  companies: (NovelCompanyLink & { company: Company | null })[]
  relations: MediaRelationEntry[]
  sessions: NovelSession[]
}

export type NovelContext = EntityDetailContext<NovelData>
export type NovelProviderReturn = EntityDetailProviderReturn<NovelData, EntitySpoilerParams>

// =============================================================================
// Data Fetcher
// =============================================================================

async function fetchNovelData(
  novelId: string,
  spoilersRevealed: boolean,
  showNsfw: boolean
): Promise<NovelData | null> {
  if (!novelId) return null

  const novelWhere = and(
    eq(schema.novels.id, novelId),
    showNsfw ? undefined : eq(schema.novels.isNsfw, false)
  )
  const [novelData] = await db.select().from(schema.novels).where(novelWhere).limit(1)

  if (!novelData) return null

  const novelTagLinksWhere = and(
    eq(schema.novelTagLinks.novelId, novelId),
    spoilersRevealed ? undefined : eq(schema.novelTagLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.tags.isNsfw, false)
  )

  const novelCharacterLinksWhere = and(
    eq(schema.novelCharacterLinks.novelId, novelId),
    spoilersRevealed ? undefined : eq(schema.novelCharacterLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.characters.isNsfw, false)
  )

  const novelPersonLinksWhere = and(
    eq(schema.novelPersonLinks.novelId, novelId),
    spoilersRevealed ? undefined : eq(schema.novelPersonLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.persons.isNsfw, false)
  )

  const novelCompanyLinksWhere = and(
    eq(schema.novelCompanyLinks.novelId, novelId),
    spoilersRevealed ? undefined : eq(schema.novelCompanyLinks.isSpoiler, false),
    showNsfw ? undefined : eq(schema.companies.isNsfw, false)
  )

  const [volumes, notes, tagLinks, charLinks, personLinks, companyLinks, relations, sessions] =
    await Promise.all([
      db
        .select()
        .from(schema.novelVolumes)
        .where(eq(schema.novelVolumes.novelId, novelId))
        .orderBy(asc(schema.novelVolumes.orderInNovel), asc(schema.novelVolumes.volumeNumber)),
      db
        .select()
        .from(schema.novelNotes)
        .where(eq(schema.novelNotes.novelId, novelId))
        .orderBy(asc(schema.novelNotes.orderInNovel), asc(schema.novelNotes.name)),
      db
        .select()
        .from(schema.novelTagLinks)
        .leftJoin(schema.tags, eq(schema.novelTagLinks.tagId, schema.tags.id))
        .where(novelTagLinksWhere)
        .orderBy(asc(schema.novelTagLinks.orderInNovel)),
      db
        .select()
        .from(schema.novelCharacterLinks)
        .leftJoin(
          schema.characters,
          eq(schema.novelCharacterLinks.characterId, schema.characters.id)
        )
        .where(novelCharacterLinksWhere)
        .orderBy(asc(schema.novelCharacterLinks.orderInNovel)),
      db
        .select()
        .from(schema.novelPersonLinks)
        .leftJoin(schema.persons, eq(schema.novelPersonLinks.personId, schema.persons.id))
        .where(novelPersonLinksWhere)
        .orderBy(asc(schema.novelPersonLinks.orderInNovel)),
      db
        .select()
        .from(schema.novelCompanyLinks)
        .leftJoin(schema.companies, eq(schema.novelCompanyLinks.companyId, schema.companies.id))
        .where(novelCompanyLinksWhere)
        .orderBy(asc(schema.novelCompanyLinks.orderInNovel)),
      fetchMediaRelations('novel', novelId, showNsfw),
      db
        .select()
        .from(schema.novelSessions)
        .where(eq(schema.novelSessions.novelId, novelId))
        .orderBy(desc(schema.novelSessions.startedAt))
    ])

  return {
    novel: novelData,
    volumes: await attachVolumeFiles(volumes),
    notes,
    tags: tagLinks.map((row) => ({ ...row.novel_tag_links, tag: row.tags })),
    characters: charLinks.map((row) => ({
      ...row.novel_character_links,
      character: row.characters
    })),
    persons: personLinks.map((row) => ({ ...row.novel_person_links, person: row.persons })),
    companies: companyLinks.map((row) => ({
      ...row.novel_company_links,
      company: row.companies
    })),
    relations,
    sessions
  }
}

/** Files are loaded in one query and grouped in memory to keep volume order stable. */
async function attachVolumeFiles(volumes: NovelVolume[]): Promise<NovelVolumeEntry[]> {
  if (volumes.length === 0) return []

  const files = await db
    .select()
    .from(schema.novelVolumeFiles)
    .where(
      inArray(
        schema.novelVolumeFiles.volumeId,
        volumes.map((volume) => volume.id)
      )
    )
    .orderBy(desc(schema.novelVolumeFiles.isPrimary), asc(schema.novelVolumeFiles.createdAt))

  const filesByVolume = new Map<string, NovelVolumeFile[]>()
  for (const file of files) {
    const bucket = filesByVolume.get(file.volumeId)
    if (bucket) {
      bucket.push(file)
    } else {
      filesByVolume.set(file.volumeId, [file])
    }
  }

  return volumes.map((volume) => ({ ...volume, files: filesByVolume.get(volume.id) ?? [] }))
}

// =============================================================================
// Context Wiring
// =============================================================================

/** Owned rows, link rows, and the tables the links join. */
const NOVEL_TABLES: readonly TableName[] = [
  'novel_volumes',
  'novel_volume_files',
  'novel_notes',
  'novel_sessions',
  'novel_tag_links',
  'tags',
  'novel_character_links',
  'characters',
  'novel_person_links',
  'persons',
  'novel_company_links',
  'companies',
  ...MEDIA_RELATION_TABLES
]

const novelDetail = createEntityDetailContext<NovelData, EntitySpoilerParams>({
  entityType: 'novel',
  empty: {
    novel: null,
    volumes: [],
    notes: [],
    tags: [],
    characters: [],
    persons: [],
    companies: [],
    relations: [],
    sessions: []
  },
  initialParams: createEntitySpoilerParams,
  fetch: (id, params, view) => fetchNovelData(id, params.spoilersRevealed, view.showNsfw),
  tables: NOVEL_TABLES
})

export const novelDetailQuery = novelDetail.detailQuery
export const useNovelRouteProvider = novelDetail.useRouteProvider
export const useNovelDialogProvider = novelDetail.useDialogProvider
export const useNovel = novelDetail.useContext
