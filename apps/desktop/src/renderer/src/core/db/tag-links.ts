/**
 * Tag link-table registry.
 *
 * Every content entity owns its own `<entity>_tag_links` table with
 * entity-named anchor and order columns. Both directions of the relation read
 * this one declaration: the tags of an entity, and the entities of a tag.
 */
import { and, asc, count, eq, getTableColumns, getTableName, type SQL } from 'drizzle-orm'
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'

import type { ContentEntityType } from '@shared/common'
import type { TableName } from '@shared/db/table-names'
import {
  animeTagLinks,
  characterTagLinks,
  comicTagLinks,
  companyTagLinks,
  gameTagLinks,
  novelTagLinks,
  personTagLinks,
  tags
} from '@shared/db'
import { ENTITY_TABLES, type EntityRowMap } from './entity-tables'
import { db } from './proxy'

/** A tag link row to write, before it is named for its link table. */
export interface TagLinkRow {
  id: string
  tagId: string
  note: string | null
  isSpoiler: boolean
}

export interface TagLinkDef {
  table: SQLiteTable
  tableName: TableName
  idColumn: SQLiteColumn
  tagIdColumn: SQLiteColumn
  entityIdColumn: SQLiteColumn
  noteColumn: SQLiteColumn
  isSpoilerColumn: SQLiteColumn
  /** Order of the tag within the entity's own tag list. */
  orderInEntityColumn: SQLiteColumn
  /** Order of the entity within the tag's entity list. */
  orderInTagColumn: SQLiteColumn
  /** Names the anchor and its order after the link table's own columns. */
  buildInsertValue(
    entityId: string,
    row: TagLinkRow,
    orderInEntity: number
  ): Record<string, unknown>
}

export const TAG_LINKS: Record<ContentEntityType, TagLinkDef> = {
  game: {
    table: gameTagLinks,
    tableName: getTableName(gameTagLinks),
    idColumn: gameTagLinks.id,
    tagIdColumn: gameTagLinks.tagId,
    entityIdColumn: gameTagLinks.gameId,
    noteColumn: gameTagLinks.note,
    isSpoilerColumn: gameTagLinks.isSpoiler,
    orderInEntityColumn: gameTagLinks.orderInGame,
    orderInTagColumn: gameTagLinks.orderInTag,
    buildInsertValue(entityId, row, orderInEntity) {
      return { ...row, gameId: entityId, orderInGame: orderInEntity }
    }
  },
  anime: {
    table: animeTagLinks,
    tableName: getTableName(animeTagLinks),
    idColumn: animeTagLinks.id,
    tagIdColumn: animeTagLinks.tagId,
    entityIdColumn: animeTagLinks.animeId,
    noteColumn: animeTagLinks.note,
    isSpoilerColumn: animeTagLinks.isSpoiler,
    orderInEntityColumn: animeTagLinks.orderInAnime,
    orderInTagColumn: animeTagLinks.orderInTag,
    buildInsertValue(entityId, row, orderInEntity) {
      return { ...row, animeId: entityId, orderInAnime: orderInEntity }
    }
  },
  comic: {
    table: comicTagLinks,
    tableName: getTableName(comicTagLinks),
    idColumn: comicTagLinks.id,
    tagIdColumn: comicTagLinks.tagId,
    entityIdColumn: comicTagLinks.comicId,
    noteColumn: comicTagLinks.note,
    isSpoilerColumn: comicTagLinks.isSpoiler,
    orderInEntityColumn: comicTagLinks.orderInComic,
    orderInTagColumn: comicTagLinks.orderInTag,
    buildInsertValue(entityId, row, orderInEntity) {
      return { ...row, comicId: entityId, orderInComic: orderInEntity }
    }
  },
  novel: {
    table: novelTagLinks,
    tableName: getTableName(novelTagLinks),
    idColumn: novelTagLinks.id,
    tagIdColumn: novelTagLinks.tagId,
    entityIdColumn: novelTagLinks.novelId,
    noteColumn: novelTagLinks.note,
    isSpoilerColumn: novelTagLinks.isSpoiler,
    orderInEntityColumn: novelTagLinks.orderInNovel,
    orderInTagColumn: novelTagLinks.orderInTag,
    buildInsertValue(entityId, row, orderInEntity) {
      return { ...row, novelId: entityId, orderInNovel: orderInEntity }
    }
  },
  character: {
    table: characterTagLinks,
    tableName: getTableName(characterTagLinks),
    idColumn: characterTagLinks.id,
    tagIdColumn: characterTagLinks.tagId,
    entityIdColumn: characterTagLinks.characterId,
    noteColumn: characterTagLinks.note,
    isSpoilerColumn: characterTagLinks.isSpoiler,
    orderInEntityColumn: characterTagLinks.orderInCharacter,
    orderInTagColumn: characterTagLinks.orderInTag,
    buildInsertValue(entityId, row, orderInEntity) {
      return { ...row, characterId: entityId, orderInCharacter: orderInEntity }
    }
  },
  person: {
    table: personTagLinks,
    tableName: getTableName(personTagLinks),
    idColumn: personTagLinks.id,
    tagIdColumn: personTagLinks.tagId,
    entityIdColumn: personTagLinks.personId,
    noteColumn: personTagLinks.note,
    isSpoilerColumn: personTagLinks.isSpoiler,
    orderInEntityColumn: personTagLinks.orderInPerson,
    orderInTagColumn: personTagLinks.orderInTag,
    buildInsertValue(entityId, row, orderInEntity) {
      return { ...row, personId: entityId, orderInPerson: orderInEntity }
    }
  },
  company: {
    table: companyTagLinks,
    tableName: getTableName(companyTagLinks),
    idColumn: companyTagLinks.id,
    tagIdColumn: companyTagLinks.tagId,
    entityIdColumn: companyTagLinks.companyId,
    noteColumn: companyTagLinks.note,
    isSpoilerColumn: companyTagLinks.isSpoiler,
    orderInEntityColumn: companyTagLinks.orderInCompany,
    orderInTagColumn: companyTagLinks.orderInTag,
    buildInsertValue(entityId, row, orderInEntity) {
      return { ...row, companyId: entityId, orderInCompany: orderInEntity }
    }
  }
}

/** A tag attached to an entity, with the tag's display name. */
export interface EntityTagLink extends TagLinkRow {
  tagName: string
}

/**
 * Reads one entity's tag links in stored order.
 *
 * The registry columns are untyped `SQLiteColumn`, so the row shape is asserted
 * once here; this is the module's controlled unsafe point, as in `entity-query`.
 */
export async function queryEntityTagLinks(
  entityType: ContentEntityType,
  entityId: string
): Promise<EntityTagLink[]> {
  const def = TAG_LINKS[entityType]

  const rows = await db
    .select({
      id: def.idColumn,
      tagId: def.tagIdColumn,
      tagName: tags.name,
      note: def.noteColumn,
      isSpoiler: def.isSpoilerColumn
    })
    .from(def.table)
    .innerJoin(tags, eq(def.tagIdColumn, tags.id))
    .where(eq(def.entityIdColumn, entityId))
    .orderBy(asc(def.orderInEntityColumn))

  return rows as EntityTagLink[]
}

/** Replaces one entity's full tag-link list, persisting array order. */
export async function replaceEntityTagLinks(
  entityType: ContentEntityType,
  entityId: string,
  rows: readonly TagLinkRow[]
): Promise<void> {
  const def = TAG_LINKS[entityType]

  await db.delete(def.table).where(eq(def.entityIdColumn, entityId))
  if (rows.length === 0) return

  await db
    .insert(def.table)
    .values(rows.map((row, index) => def.buildInsertValue(entityId, row, index)) as never[])
}

function buildTagMemberWhere(
  def: TagLinkDef,
  entityType: ContentEntityType,
  tagId: string,
  includeNsfw: boolean
): SQL | undefined {
  const parts: SQL[] = [eq(def.tagIdColumn, tagId)]
  if (!includeNsfw) parts.push(eq(ENTITY_TABLES[entityType].isNsfwColumn, false))
  return and(...parts)
}

/** Counts the entities of one type that carry the tag. */
export async function countTaggedEntities(
  entityType: ContentEntityType,
  tagId: string,
  includeNsfw: boolean
): Promise<number> {
  const def = TAG_LINKS[entityType]
  const entity = ENTITY_TABLES[entityType]

  const rows = await db
    .select({ value: count() })
    .from(def.table)
    .innerJoin(entity.table, eq(def.entityIdColumn, entity.idColumn))
    .where(buildTagMemberWhere(def, entityType, tagId, includeNsfw))

  return Number(rows[0]?.value ?? 0)
}

/** Reads the entities of one type that carry the tag, in the tag's own order. */
export async function queryTaggedEntities<T extends ContentEntityType>(
  entityType: T,
  tagId: string,
  includeNsfw: boolean
): Promise<EntityRowMap[T][]> {
  const def = TAG_LINKS[entityType]
  const entity = ENTITY_TABLES[entityType]

  const rows = await db
    .select(getTableColumns(entity.table))
    .from(def.table)
    .innerJoin(entity.table, eq(def.entityIdColumn, entity.idColumn))
    .where(buildTagMemberWhere(def, entityType, tagId, includeNsfw))
    .orderBy(asc(def.orderInTagColumn))

  return rows as EntityRowMap[T][]
}
