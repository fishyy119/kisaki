/**
 * Change projection for playable media entries.
 *
 * Games and anime differ only in table names, asset columns, and the episode
 * facet, so one projection descriptor drives both instead of a per-media copy.
 */

import type Database from 'better-sqlite3'
import type { AnimeStatus, GameStatus } from '@shared/db/contracts/enums'
import type { RawDbChange } from '@shared/db/changes'
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
import type { MediaFeedProjection, MediaRow } from '../types'
import {
  normalizeActivityValue,
  normalizeCoreValue,
  normalizeNullableString,
  nullableNumber,
  stringValue,
  uniqueStrings
} from '../shared/normalization'
import { createPartialSnapshot, sameJson } from '../shared/snapshot'

const GAME_PROJECTION: MediaFeedProjection = {
  entity: 'game',
  table: 'games',
  ownerColumn: 'game_id',
  orderColumn: 'order_in_game',
  externalIdsTable: 'game_external_ids',
  tagLinksTable: 'game_tag_links',
  collectionLinksTable: 'collection_game_links',
  linkTables: {
    person: 'game_person_links',
    company: 'game_company_links',
    character: 'game_character_links'
  },
  ownedTables: ['game_sessions'],
  coreFields: {
    name: 'name',
    original_name: 'originalName',
    description: 'description',
    release_date: 'releaseDate'
  },
  assetFields: {
    cover_file: 'coverFile',
    backdrop_file: 'backdropFile',
    logo_file: 'logoFile',
    icon_file: 'iconFile'
  }
}

const ANIME_PROJECTION: MediaFeedProjection = {
  entity: 'anime',
  table: 'animes',
  ownerColumn: 'anime_id',
  orderColumn: 'order_in_anime',
  externalIdsTable: 'anime_external_ids',
  tagLinksTable: 'anime_tag_links',
  collectionLinksTable: 'collection_anime_links',
  linkTables: {
    person: 'anime_person_links',
    company: 'anime_company_links',
    character: 'anime_character_links'
  },
  // `anime_episode_files` and `anime_extra_files` have no anime_id column, so
  // the owner-column mechanism cannot cover them; file-row changes reach
  // subscribers via the episode/extra rows they hang off. If extension
  // subscribers ever need file-level changes, route them through a two-step
  // lookup (file -> episode/extra -> anime) instead of widening this list.
  ownedTables: ['anime_episodes', 'anime_extras', 'anime_sessions'],
  coreFields: {
    name: 'name',
    original_name: 'originalName',
    description: 'description',
    release_date: 'releaseDate',
    format: 'format',
    total_episodes: 'totalEpisodes'
  },
  assetFields: {
    cover_file: 'coverFile',
    backdrop_file: 'backdropFile',
    logo_file: 'logoFile'
  },
  episodesTable: 'anime_episodes'
}

export const MEDIA_PROJECTIONS: readonly MediaFeedProjection[] = [GAME_PROJECTION, ANIME_PROJECTION]

export function getMediaProjectionForTable(table: string): MediaFeedProjection | undefined {
  return MEDIA_PROJECTIONS.find((projection) => projection.table === table)
}

export function getMediaProjectionForTopic(
  entity: LibraryEntityTopic
): MediaFeedProjection | undefined {
  return MEDIA_PROJECTIONS.find((projection) => projection.entity === entity)
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

  const linkTables = Object.values(projection.linkTables)
  const linkChanges = changes.filter((change) => linkTables.includes(change.table))
  if (linkChanges.length > 0) {
    const after = readLinkSnapshot(sqlite, projection, mediaId)
    const before = rebuildLinkSnapshotBefore(after, projection.linkTables, linkChanges)
    if (!sameJson(before, after)) {
      projected.push({
        facet: 'links',
        before,
        after,
        fields: ['personLinkIds', 'companyLinkIds', 'characterLinkIds']
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
      before: { status: firstOld.status as GameStatus | AnimeStatus },
      after: { status: lastNext.status as GameStatus | AnimeStatus },
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

  return {
    personLinkIds: readLinkIds(projection.linkTables.person),
    companyLinkIds: readLinkIds(projection.linkTables.company),
    characterLinkIds: readLinkIds(projection.linkTables.character)
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
