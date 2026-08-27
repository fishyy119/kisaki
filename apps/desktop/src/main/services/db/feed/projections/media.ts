/**
 * Change projection for playable media entries.
 *
 * The media types differ only in table names, asset columns, and their
 * consumption facet (episodes or readable units), so one projection descriptor
 * drives all of them instead of a per-media copy.
 */

import type Database from 'better-sqlite3'
import { getTableName } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { MediaStatus } from '@shared/db/contracts/enums'
import type { RawDbChange } from '@shared/db/changes'
import {
  animeCastLinks,
  animeCharacterLinks,
  animeCompanyLinks,
  animeEpisodes,
  animeExternalIds,
  animeExtras,
  animePersonLinks,
  animeSessions,
  animeTagLinks,
  animes,
  collectionAnimeLinks,
  collectionComicLinks,
  collectionGameLinks,
  collectionNovelLinks,
  comicChapters,
  comicCharacterLinks,
  comicCompanyLinks,
  comicExternalIds,
  comicPersonLinks,
  comicSessions,
  comicTagLinks,
  comics,
  gameCastLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gameExternalIds,
  gamePersonLinks,
  gameSessions,
  gameTagLinks,
  games,
  novelCharacterLinks,
  novelCompanyLinks,
  novelExternalIds,
  novelPersonLinks,
  novelSessions,
  novelTagLinks,
  novelVolumes,
  novels
} from '@shared/db/schema'
import type {
  LibraryChange,
  LibraryEntityTopic,
  LibraryMediaActivitySnapshot,
  LibraryMediaLinkSnapshot,
  LibraryMediaRelationEdge
} from '@shared/library'
import type { ExternalId } from '@shared/identity'
import {
  rebuildExternalIdsBefore,
  rebuildFlaggedIdSetBefore,
  rebuildIdSetBefore,
  rebuildLinkSnapshotBefore,
  rebuildMediaRelationEdgesBefore
} from '../rebuild'
import type { MediaEntityTopic, MediaFeedProjection, MediaRow } from '../types'
import {
  normalizeActivityValue,
  normalizeCoreValue,
  normalizeNullableString,
  nullableNumber,
  stringValue,
  uniqueStrings
} from '../normalization'
import { createPartialSnapshot, sameJson } from '../snapshot'

const GAME_PROJECTION: MediaFeedProjection = {
  entity: 'game',
  table: getTableName(games),
  ownerColumn: gameExternalIds.gameId.name,
  orderColumn: gameTagLinks.orderInGame.name,
  externalIdsTable: getTableName(gameExternalIds),
  tagLinksTable: getTableName(gameTagLinks),
  collectionLinksTable: getTableName(collectionGameLinks),
  linkTables: {
    person: getTableName(gamePersonLinks),
    company: getTableName(gameCompanyLinks),
    character: getTableName(gameCharacterLinks),
    cast: getTableName(gameCastLinks)
  },
  ownedTables: [getTableName(gameSessions)],
  coreFields: fieldMap({
    name: games.name,
    originalName: games.originalName,
    aliases: games.aliases,
    description: games.description,
    releaseDate: games.releaseDate
  }),
  assetFields: fieldMap({
    coverFile: games.coverFile,
    backdropFile: games.backdropFile,
    logoFile: games.logoFile,
    iconFile: games.iconFile
  })
}

const ANIME_PROJECTION: MediaFeedProjection = {
  entity: 'anime',
  table: getTableName(animes),
  ownerColumn: animeExternalIds.animeId.name,
  orderColumn: animeTagLinks.orderInAnime.name,
  externalIdsTable: getTableName(animeExternalIds),
  tagLinksTable: getTableName(animeTagLinks),
  collectionLinksTable: getTableName(collectionAnimeLinks),
  linkTables: {
    person: getTableName(animePersonLinks),
    company: getTableName(animeCompanyLinks),
    character: getTableName(animeCharacterLinks),
    cast: getTableName(animeCastLinks)
  },
  // `anime_episode_files` and `anime_extra_files` have no anime_id column, so
  // the owner-column mechanism cannot cover them; file-row changes reach
  // subscribers via the episode/extra rows they hang off. If extension
  // subscribers ever need file-level changes, route them through a two-step
  // lookup (file -> episode/extra -> anime) instead of widening this list.
  ownedTables: [
    getTableName(animeEpisodes),
    getTableName(animeExtras),
    getTableName(animeSessions)
  ],
  coreFields: fieldMap({
    name: animes.name,
    originalName: animes.originalName,
    aliases: animes.aliases,
    description: animes.description,
    releaseDate: animes.releaseDate,
    format: animes.format,
    totalEpisodes: animes.totalEpisodes
  }),
  assetFields: fieldMap({
    coverFile: animes.coverFile,
    backdropFile: animes.backdropFile,
    logoFile: animes.logoFile
  }),
  episodesTable: getTableName(animeEpisodes)
}

const COMIC_PROJECTION: MediaFeedProjection = {
  entity: 'comic',
  table: getTableName(comics),
  ownerColumn: comicExternalIds.comicId.name,
  orderColumn: comicTagLinks.orderInComic.name,
  externalIdsTable: getTableName(comicExternalIds),
  tagLinksTable: getTableName(comicTagLinks),
  collectionLinksTable: getTableName(collectionComicLinks),
  linkTables: {
    person: getTableName(comicPersonLinks),
    company: getTableName(comicCompanyLinks),
    character: getTableName(comicCharacterLinks)
  },
  // Chapter file rows have no comic_id column; file-row changes reach
  // subscribers via the chapter rows they hang off, like anime episode files.
  ownedTables: [getTableName(comicChapters), getTableName(comicSessions)],
  coreFields: fieldMap({
    name: comics.name,
    originalName: comics.originalName,
    aliases: comics.aliases,
    description: comics.description,
    releaseDate: comics.releaseDate,
    format: comics.format,
    readingDirection: comics.readingDirection,
    totalVolumes: comics.totalVolumes,
    totalChapters: comics.totalChapters
  }),
  assetFields: fieldMap({
    coverFile: comics.coverFile,
    backdropFile: comics.backdropFile,
    logoFile: comics.logoFile
  }),
  unitsTable: getTableName(comicChapters)
}

const NOVEL_PROJECTION: MediaFeedProjection = {
  entity: 'novel',
  table: getTableName(novels),
  ownerColumn: novelExternalIds.novelId.name,
  orderColumn: novelTagLinks.orderInNovel.name,
  externalIdsTable: getTableName(novelExternalIds),
  tagLinksTable: getTableName(novelTagLinks),
  collectionLinksTable: getTableName(collectionNovelLinks),
  linkTables: {
    person: getTableName(novelPersonLinks),
    company: getTableName(novelCompanyLinks),
    character: getTableName(novelCharacterLinks)
  },
  ownedTables: [getTableName(novelVolumes), getTableName(novelSessions)],
  coreFields: fieldMap({
    name: novels.name,
    originalName: novels.originalName,
    aliases: novels.aliases,
    description: novels.description,
    releaseDate: novels.releaseDate,
    format: novels.format,
    totalVolumes: novels.totalVolumes
  }),
  assetFields: fieldMap({
    coverFile: novels.coverFile,
    backdropFile: novels.backdropFile,
    logoFile: novels.logoFile
  }),
  unitsTable: getTableName(novelVolumes)
}

/**
 * Maps raw change keys (SQL column names) to snapshot property names, taking
 * both sides from the schema so a column rename cannot drift the projection.
 */
function fieldMap(columns: Record<string, AnySQLiteColumn>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(columns).map(([property, column]) => [column.name, property])
  )
}

/**
 * Every media type's projection, keyed by the union so adding a media type
 * fails to compile here instead of silently dropping it from the feed.
 */
const MEDIA_PROJECTION_BY_TOPIC = {
  game: GAME_PROJECTION,
  anime: ANIME_PROJECTION,
  comic: COMIC_PROJECTION,
  novel: NOVEL_PROJECTION
} as const satisfies Record<MediaEntityTopic, MediaFeedProjection>

export const MEDIA_PROJECTIONS: readonly MediaFeedProjection[] =
  Object.values(MEDIA_PROJECTION_BY_TOPIC)

export function getMediaProjectionForTable(table: string): MediaFeedProjection | undefined {
  return MEDIA_PROJECTIONS.find((projection) => projection.table === table)
}

export function getMediaProjectionForTopic(
  entity: LibraryEntityTopic
): MediaFeedProjection | undefined {
  return isMediaEntityTopic(entity) ? MEDIA_PROJECTION_BY_TOPIC[entity] : undefined
}

function isMediaEntityTopic(entity: LibraryEntityTopic): entity is MediaEntityTopic {
  return entity in MEDIA_PROJECTION_BY_TOPIC
}

const MEDIA_RELATIONS_TABLE = 'media_relations'

/** Media rows reached indirectly, through a link, relation, or owned row that changed. */
export function getMediaIdsFromChange(
  projection: MediaFeedProjection,
  change: RawDbChange
): string[] {
  // Relation rows are polymorphic on both ends, so each end routes to its own
  // media type instead of a fixed owner column.
  if (change.table === MEDIA_RELATIONS_TABLE) {
    return uniqueStrings([
      ...mediaRelationEndIds(projection.entity, change.old),
      ...mediaRelationEndIds(projection.entity, change.next)
    ])
  }

  if (!relatedTables(projection).has(change.table)) {
    return []
  }

  return uniqueStrings([
    stringValue(change.old?.[projection.ownerColumn]),
    stringValue(change.next?.[projection.ownerColumn])
  ])
}

function mediaRelationEndIds(
  mediaType: MediaFeedProjection['entity'],
  row: Record<string, unknown> | undefined
): Array<string | undefined> {
  if (!row) return []

  return [
    row.from_type === mediaType ? stringValue(row.from_id) : undefined,
    row.to_type === mediaType ? stringValue(row.to_id) : undefined
  ]
}

export function getMediaCreatedName(
  sqlite: Database.Database,
  projection: MediaFeedProjection,
  mediaId: string,
  next?: Record<string, unknown>
): string {
  const current = readMediaRow(sqlite, projection, mediaId)
  return current?.name ?? stringValue(next?.name) ?? mediaId
}

export function mediaExists(
  sqlite: Database.Database,
  projection: MediaFeedProjection,
  mediaId: string
): boolean {
  return Boolean(readMediaRow(sqlite, projection, mediaId))
}

export function projectMediaChanges(
  sqlite: Database.Database,
  projection: MediaFeedProjection,
  mediaId: string,
  changes: RawDbChange[]
): LibraryChange[] {
  const projected: LibraryChange[] = []

  projected.push(
    ...projectDirectChanges(
      projection,
      changes.filter((change) => change.table === projection.table)
    )
  )

  const externalIdChanges = changes.filter((change) => change.table === projection.externalIdsTable)
  if (externalIdChanges.length > 0) {
    const after = readExternalIds(sqlite, projection, mediaId)
    const before = rebuildExternalIdsBefore(after, externalIdChanges)
    if (!sameJson(before, after)) {
      projected.push({
        facet: 'identity',
        before: { externalIds: before },
        after: { externalIds: after },
        fields: ['externalIds']
      })
    }
  }

  const tagIds = projectIdSet(sqlite, {
    changes,
    table: projection.tagLinksTable,
    field: 'tag_id',
    sql: `SELECT tag_id AS id FROM ${projection.tagLinksTable} WHERE ${projection.ownerColumn} = ? ORDER BY ${projection.orderColumn} ASC, id ASC`,
    mediaId
  })
  if (tagIds) {
    projected.push({
      facet: 'tags',
      before: { tagIds: tagIds.before },
      after: { tagIds: tagIds.after },
      fields: ['tagIds']
    })
  }

  const collectionIds = projectIdSet(sqlite, {
    changes,
    table: projection.collectionLinksTable,
    field: 'collection_id',
    sql: `SELECT collection_id AS id FROM ${projection.collectionLinksTable} WHERE ${projection.ownerColumn} = ? ORDER BY order_in_collection ASC, id ASC`,
    mediaId
  })
  if (collectionIds) {
    projected.push({
      facet: 'collections',
      before: { collectionIds: collectionIds.before },
      after: { collectionIds: collectionIds.after },
      fields: ['collectionIds']
    })
  }

  const linkTables = Object.values(projection.linkTables).filter(
    (table): table is string => table !== undefined
  )
  const linkChanges = changes.filter((change) => linkTables.includes(change.table))
  if (linkChanges.length > 0) {
    const after = readLinkSnapshot(sqlite, projection, mediaId)
    const before = rebuildLinkSnapshotBefore(after, projection.linkTables, linkChanges)
    if (!sameJson(before, after)) {
      projected.push({
        facet: 'links',
        before,
        after,
        fields: [
          'personLinkIds',
          'companyLinkIds',
          'characterLinkIds',
          // Only advertised by media types that own a cast table.
          ...(projection.linkTables.cast ? ['castLinkIds'] : [])
        ]
      })
    }
  }

  const relationChanges = changes.filter((change) => change.table === MEDIA_RELATIONS_TABLE)
  if (relationChanges.length > 0) {
    const after = readMediaRelationEdges(sqlite, projection.entity, mediaId)
    const before = rebuildMediaRelationEdgesBefore(
      after,
      relationChanges,
      projection.entity,
      mediaId
    )
    if (!sameJson(before, after)) {
      projected.push({
        facet: 'relations',
        before: { relations: before },
        after: { relations: after },
        fields: ['relations']
      })
    }
  }

  const episodes = projectEpisodesChange(sqlite, projection, mediaId, changes)
  if (episodes) {
    projected.push(episodes)
  }

  const units = projectUnitsChange(sqlite, projection, mediaId, changes)
  if (units) {
    projected.push(units)
  }

  return projected
}

function projectDirectChanges(
  projection: MediaFeedProjection,
  changes: RawDbChange[]
): LibraryChange[] {
  const firstOld = changes.find((change) => change.old)?.old
  const lastNext = changes.findLast((change) => change.next)?.next
  if (!firstOld || !lastNext) {
    return []
  }

  const projected: LibraryChange[] = []

  if (firstOld.status !== lastNext.status) {
    projected.push({
      facet: 'status',
      before: { status: firstOld.status as MediaStatus },
      after: { status: lastNext.status as MediaStatus },
      fields: ['status']
    })
  }

  if (nullableNumber(firstOld.score) !== nullableNumber(lastNext.score)) {
    projected.push({
      facet: 'score',
      before: { score: nullableNumber(firstOld.score) },
      after: { score: nullableNumber(lastNext.score) },
      fields: ['score']
    })
  }

  const activity = createPartialSnapshot<LibraryMediaActivitySnapshot>(
    firstOld,
    lastNext,
    {
      total_duration: 'totalDuration',
      last_active_at: 'lastActiveAt'
    },
    normalizeActivityValue
  )
  if (activity.fields.length > 0) {
    projected.push({
      facet: 'activity',
      before: activity.before,
      after: activity.after,
      fields: activity.fields
    })
  }

  const assets = createPartialSnapshot(
    firstOld,
    lastNext,
    projection.assetFields,
    normalizeNullableString
  )
  if (assets.fields.length > 0) {
    projected.push({
      facet: 'assets',
      before: assets.before,
      after: assets.after,
      fields: assets.fields
    })
  }

  const core = createPartialSnapshot(firstOld, lastNext, projection.coreFields, normalizeCoreValue)
  if (core.fields.length > 0) {
    projected.push({
      facet: 'core',
      before: core.before,
      after: core.after,
      fields: core.fields
    })
  }

  return projected
}

function projectEpisodesChange(
  sqlite: Database.Database,
  projection: MediaFeedProjection,
  mediaId: string,
  changes: RawDbChange[]
): LibraryChange | null {
  const episodesTable = projection.episodesTable
  if (!episodesTable) {
    return null
  }

  const episodeChanges = changes.filter((change) => change.table === episodesTable)
  if (episodeChanges.length === 0) {
    return null
  }

  const after = readIds(
    sqlite,
    `SELECT id FROM ${episodesTable} WHERE ${projection.ownerColumn} = ? AND watched = 1 ORDER BY id ASC`,
    mediaId
  )
  const before = rebuildFlaggedIdSetBefore(after, episodeChanges, 'watched')
  if (sameJson(before, after)) {
    return null
  }

  return {
    facet: 'episodes',
    before: { watchedEpisodeIds: before },
    after: { watchedEpisodeIds: after },
    fields: ['watchedEpisodeIds']
  }
}

function projectUnitsChange(
  sqlite: Database.Database,
  projection: MediaFeedProjection,
  mediaId: string,
  changes: RawDbChange[]
): LibraryChange | null {
  const unitsTable = projection.unitsTable
  if (!unitsTable) {
    return null
  }

  const unitChanges = changes.filter((change) => change.table === unitsTable)
  if (unitChanges.length === 0) {
    return null
  }

  const after = readIds(
    sqlite,
    `SELECT id FROM ${unitsTable} WHERE ${projection.ownerColumn} = ? AND read = 1 ORDER BY id ASC`,
    mediaId
  )
  const before = rebuildFlaggedIdSetBefore(after, unitChanges, 'read')
  if (sameJson(before, after)) {
    return null
  }

  return {
    facet: 'units',
    before: { readUnitIds: before },
    after: { readUnitIds: after },
    fields: ['readUnitIds']
  }
}

function projectIdSet(
  sqlite: Database.Database,
  options: {
    changes: RawDbChange[]
    table: string
    field: string
    sql: string
    mediaId: string
  }
): { before: string[]; after: string[] } | null {
  const linkChanges = options.changes.filter((change) => change.table === options.table)
  if (linkChanges.length === 0) {
    return null
  }

  const after = readIds(sqlite, options.sql, options.mediaId)
  const before = rebuildIdSetBefore(after, linkChanges, options.field)
  return sameJson(before, after) ? null : { before, after }
}

function relatedTables(projection: MediaFeedProjection): Set<string> {
  return new Set([
    projection.externalIdsTable,
    projection.tagLinksTable,
    projection.collectionLinksTable,
    ...Object.values(projection.linkTables),
    ...projection.ownedTables
  ])
}

function readMediaRow(
  sqlite: Database.Database,
  projection: MediaFeedProjection,
  mediaId: string
): MediaRow | null {
  return (
    (sqlite.prepare(`SELECT id, name FROM ${projection.table} WHERE id = ?`).get(mediaId) as
      MediaRow | undefined) ?? null
  )
}

function readExternalIds(
  sqlite: Database.Database,
  projection: MediaFeedProjection,
  mediaId: string
): ExternalId[] {
  const rows = sqlite
    .prepare(
      `SELECT source, external_id FROM ${projection.externalIdsTable} WHERE ${projection.ownerColumn} = ? ORDER BY ${projection.orderColumn} ASC, id ASC`
    )
    .all(mediaId) as Array<{ source: string; external_id: string }>
  return rows.map((row) => ({ source: row.source, id: row.external_id }))
}

function readLinkSnapshot(
  sqlite: Database.Database,
  projection: MediaFeedProjection,
  mediaId: string
): LibraryMediaLinkSnapshot {
  const readLinkIds = (table: string): string[] =>
    readIds(
      sqlite,
      `SELECT id FROM ${table} WHERE ${projection.ownerColumn} = ? ORDER BY ${projection.orderColumn} ASC, id ASC`,
      mediaId
    )

  const castTable = projection.linkTables.cast

  return {
    personLinkIds: readLinkIds(projection.linkTables.person),
    companyLinkIds: readLinkIds(projection.linkTables.company),
    characterLinkIds: readLinkIds(projection.linkTables.character),
    // Cast rows carry no order column of their own; the id keeps them stable.
    // Print media owns no cast table, so the facet is absent rather than empty.
    ...(castTable
      ? {
          castLinkIds: readIds(
            sqlite,
            `SELECT id FROM ${castTable} WHERE ${projection.ownerColumn} = ? ORDER BY id ASC`,
            mediaId
          )
        }
      : {})
  }
}

function readMediaRelationEdges(
  sqlite: Database.Database,
  mediaType: MediaFeedProjection['entity'],
  mediaId: string
): LibraryMediaRelationEdge[] {
  const rows = sqlite
    .prepare(
      'SELECT to_type, to_id, type FROM media_relations WHERE from_type = ? AND from_id = ? ORDER BY order_in_from ASC, id ASC'
    )
    .all(mediaType, mediaId) as Array<{ to_type: string; to_id: string; type: string }>

  return rows.map((row) => ({
    toType: row.to_type,
    toId: row.to_id,
    type: row.type
  })) as LibraryMediaRelationEdge[]
}

function readIds(sqlite: Database.Database, sql: string, entityId: string): string[] {
  const rows = sqlite.prepare(sql).all(entityId) as Array<{ id: string }>
  return rows.map((row) => row.id)
}
