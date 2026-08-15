import { and, eq, inArray, or } from 'drizzle-orm'
import {
  animeEpisodeExternalIds,
  animeEpisodeFiles,
  animeEpisodes,
  animeExtras,
  animeNotes,
  animeSessions,
  gameNotes,
  gameSessions,
  mediaRelations,
  type AnimeEpisode
} from '@shared/db'
import type { AllEntityType, MediaType } from '@shared/common'
import type { DbContext, DbQueryContext, DbWriteContext } from '../../types'
import type { OwnedDataMerge, RelationMergeConfig, MergeRow } from './types'

/**
 * Owned-row merges that a plain link-table rewrite cannot express. Keyed by
 * entity type so adding a media type forces an explicit decision here instead
 * of silently cascading the source's owned rows away with the source row.
 */
export const OWNED_DATA_MERGES: Record<AllEntityType, OwnedDataMerge | null> = {
  game: mergeGameOwnedData,
  anime: mergeAnimeOwnedData,
  character: null,
  person: null,
  company: null,
  collection: null,
  tag: null
}

function mergeGameOwnedData(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  return (
    mergeGameSessions(db, targetId, sourceId, now) +
    mergeGameNotes(db, targetId, sourceId, now) +
    mergeMediaRelations(db, 'game', targetId, sourceId, now)
  )
}

/**
 * Merging two entries of the same show must preserve the source's watch data.
 * Source episodes align to target episodes by shared external id first, then
 * by (type, episode number); aligned episodes fold their watch state, files,
 * identities, and sessions into the target row, unmatched episodes move to the
 * target entry wholesale (keeping their id, so episode attachments stay valid).
 */
function mergeAnimeOwnedData(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const targetEpisodes = readAnimeEpisodes(db, targetId)
  const sourceEpisodes = readAnimeEpisodes(db, sourceId)
  let changed = 0

  const alignment = buildEpisodeAlignmentIndex(db, targetEpisodes, sourceEpisodes)
  let nextEpisodeOrder = nextOrderAfter(targetEpisodes.map((episode) => episode.orderInAnime))

  for (const episode of sourceEpisodes) {
    const alignedId = alignment.get(episode.id)
    if (alignedId) {
      foldEpisodeIntoTarget(db, episode, alignedId, now)
    } else {
      db.update(animeEpisodes)
        .set({ animeId: targetId, orderInAnime: nextEpisodeOrder++, updatedAt: now })
        .where(eq(animeEpisodes.id, episode.id))
        .run()
    }
    changed++
  }

  changed += mergeAnimeSessions(db, targetId, sourceId, now)
  changed += mergeAnimeExtras(db, targetId, sourceId, now)
  changed += mergeAnimeNotes(db, targetId, sourceId, now)
  changed += mergeMediaRelations(db, 'anime', targetId, sourceId, now)
  return changed
}

function readAnimeEpisodes(db: DbContext, animeId: string): AnimeEpisode[] {
  return db.select().from(animeEpisodes).where(eq(animeEpisodes.animeId, animeId)).all()
}

/** Maps each source episode id to the target episode id it aligns with. */
function buildEpisodeAlignmentIndex(
  db: DbContext,
  targetEpisodes: AnimeEpisode[],
  sourceEpisodes: AnimeEpisode[]
): Map<string, string> {
  const byExternalId = new Map<string, string>()
  const byNumber = new Map<string, string>()
  for (const episode of targetEpisodes) {
    if (episode.episodeNumber !== null) {
      byNumber.set(`${episode.type}\0${episode.episodeNumber}`, episode.id)
    }
  }
  for (const row of readEpisodeExternalIds(db, targetEpisodes)) {
    byExternalId.set(`${row.source}\0${row.externalId}`, row.episodeId)
  }

  const sourceExternalIds = new Map<string, { source: string; externalId: string }[]>()
  for (const row of readEpisodeExternalIds(db, sourceEpisodes)) {
    const list = sourceExternalIds.get(row.episodeId) ?? []
    list.push(row)
    sourceExternalIds.set(row.episodeId, list)
  }

  const alignment = new Map<string, string>()
  const claimed = new Set<string>()
  for (const episode of sourceEpisodes) {
    const identityMatch = (sourceExternalIds.get(episode.id) ?? [])
      .map((row) => byExternalId.get(`${row.source}\0${row.externalId}`))
      .find((id) => id && !claimed.has(id))
    const numberMatch =
      episode.episodeNumber === null
        ? undefined
        : byNumber.get(`${episode.type}\0${episode.episodeNumber}`)
    const alignedId =
      identityMatch ?? (numberMatch && !claimed.has(numberMatch) ? numberMatch : undefined)
    if (alignedId) {
      alignment.set(episode.id, alignedId)
      claimed.add(alignedId)
    }
  }
  return alignment
}

function readEpisodeExternalIds(
  db: DbContext,
  episodes: AnimeEpisode[]
): { episodeId: string; source: string; externalId: string }[] {
  if (episodes.length === 0) return []
  return (db as DbQueryContext)
    .select({
      episodeId: animeEpisodeExternalIds.episodeId,
      source: animeEpisodeExternalIds.source,
      externalId: animeEpisodeExternalIds.externalId
    })
    .from(animeEpisodeExternalIds)
    .where(
      inArray(
        animeEpisodeExternalIds.episodeId,
        episodes.map((episode) => episode.id)
      )
    )
    .all()
}

/**
 * Folds a source episode into its aligned target episode: watch state merges
 * field-wise, while files, external ids, and sessions repoint to the target
 * row before the now-empty source row is removed. The target episode's own
 * still stays; the source's still would dangle once its attachment row dies.
 */
function foldEpisodeIntoTarget(
  db: DbContext,
  source: AnimeEpisode,
  targetEpisodeId: string,
  now: Date
): void {
  const target = db.select().from(animeEpisodes).where(eq(animeEpisodes.id, targetEpisodeId)).get()
  if (!target) return

  db.update(animeEpisodes)
    .set({
      watched: target.watched || source.watched,
      watchedAt: target.watchedAt ?? source.watchedAt,
      playCount: target.playCount + source.playCount,
      resumePositionMs: target.resumePositionMs ?? source.resumePositionMs,
      durationMs: target.durationMs ?? source.durationMs,
      updatedAt: now
    })
    .where(eq(animeEpisodes.id, targetEpisodeId))
    .run()

  const targetHasFiles =
    (db as DbQueryContext)
      .select({ id: animeEpisodeFiles.id })
      .from(animeEpisodeFiles)
      .where(eq(animeEpisodeFiles.episodeId, targetEpisodeId))
      .all().length > 0
  db.update(animeEpisodeFiles)
    .set({
      episodeId: targetEpisodeId,
      // The target's existing primary keeps priority over incoming files.
      ...(targetHasFiles && { isPrimary: false }),
      updatedAt: now
    })
    .where(eq(animeEpisodeFiles.episodeId, source.id))
    .run()

  db.update(animeEpisodeExternalIds)
    .set({ episodeId: targetEpisodeId, updatedAt: now })
    .where(eq(animeEpisodeExternalIds.episodeId, source.id))
    .run()

  db.update(animeSessions)
    .set({ episodeId: targetEpisodeId, updatedAt: now })
    .where(eq(animeSessions.episodeId, source.id))
    .run()

  db.delete(animeEpisodes).where(eq(animeEpisodes.id, source.id)).run()
}

function mergeAnimeSessions(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const rows = (db as DbQueryContext)
    .select({ id: animeSessions.id })
    .from(animeSessions)
    .where(eq(animeSessions.animeId, sourceId))
    .all()
  if (rows.length === 0) return 0

  db.update(animeSessions)
    .set({ animeId: targetId, updatedAt: now })
    .where(eq(animeSessions.animeId, sourceId))
    .run()
  return rows.length
}

function mergeAnimeExtras(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const sourceRows = db
    .select()
    .from(animeExtras)
    .where(eq(animeExtras.animeId, sourceId))
    .all()
    .sort((a, b) => a.orderInAnime - b.orderInAnime || toTime(a.createdAt) - toTime(b.createdAt))
  if (sourceRows.length === 0) return 0

  const targetOrders = (db as DbQueryContext)
    .select({ orderInAnime: animeExtras.orderInAnime })
    .from(animeExtras)
    .where(eq(animeExtras.animeId, targetId))
    .all()
  let nextOrder = nextOrderAfter(targetOrders.map((row) => row.orderInAnime))

  for (const row of sourceRows) {
    db.update(animeExtras)
      .set({ animeId: targetId, orderInAnime: nextOrder++, updatedAt: now })
      .where(eq(animeExtras.id, row.id))
      .run()
  }
  return sourceRows.length
}

function mergeAnimeNotes(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const rows = db
    .select()
    .from(animeNotes)
    .where(inArray(animeNotes.animeId, [targetId, sourceId]))
    .all()

  const targetRows = rows.filter((row) => row.animeId === targetId)
  const sourceRows = rows
    .filter((row) => row.animeId === sourceId)
    .sort((a, b) => a.orderInAnime - b.orderInAnime || toTime(a.createdAt) - toTime(b.createdAt))
  if (sourceRows.length === 0) return 0

  const usedNames = new Set(targetRows.map((row) => row.name))
  let nextOrder = targetRows.reduce((max, row) => Math.max(max, row.orderInAnime), -1) + 1

  for (const note of sourceRows) {
    const name = createMergedNoteName(note.name, usedNames)
    usedNames.add(name)

    db.update(animeNotes)
      .set({
        animeId: targetId,
        name,
        orderInAnime: nextOrder++,
        updatedAt: now
      })
      .where(eq(animeNotes.id, note.id))
      .run()
  }

  return sourceRows.length
}

/**
 * Media relations reference entries on both polymorphic ends, so both are
 * remapped when the type matches; edges that collapse into self-references
 * disappear and duplicates keep the earliest row. Only the target's own
 * outgoing rows are renumbered — third entries' edge lists were only partially
 * loaded and must keep their ordering.
 */
function mergeMediaRelations(
  db: DbContext,
  mediaType: MediaType,
  targetId: string,
  sourceId: string,
  now: Date
): number {
  const rows = db
    .select()
    .from(mediaRelations)
    .where(
      or(
        and(
          eq(mediaRelations.fromType, mediaType),
          inArray(mediaRelations.fromId, [targetId, sourceId])
        ),
        and(
          eq(mediaRelations.toType, mediaType),
          inArray(mediaRelations.toId, [targetId, sourceId])
        )
      )
    )
    .all()
  const isSourceEnd = (row: (typeof rows)[number]): boolean =>
    (row.fromType === mediaType && row.fromId === sourceId) ||
    (row.toType === mediaType && row.toId === sourceId)
  const sourceCount = rows.filter(isSourceEnd).length
  if (sourceCount === 0) return 0

  const survivors = new Map<string, (typeof rows)[number]>()
  for (const row of [...rows].sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt))) {
    const remapped = {
      ...row,
      fromId: row.fromType === mediaType && row.fromId === sourceId ? targetId : row.fromId,
      toId: row.toType === mediaType && row.toId === sourceId ? targetId : row.toId,
      updatedAt: now
    }
    if (remapped.fromType === remapped.toType && remapped.fromId === remapped.toId) continue

    const key = `${remapped.fromType}\0${remapped.fromId}\0${remapped.toType}\0${remapped.toId}\0${remapped.type}`
    const existing = survivors.get(key)
    if (!existing) {
      survivors.set(key, remapped)
    } else if (!hasText(existing.note) && hasText(remapped.note)) {
      existing.note = remapped.note
    }
  }

  const finalRows = [...survivors.values()]
  finalRows
    .filter((row) => row.fromType === mediaType && row.fromId === targetId)
    .sort((a, b) => a.orderInFrom - b.orderInFrom || toTime(a.createdAt) - toTime(b.createdAt))
    .forEach((row, index) => {
      row.orderInFrom = index
    })

  db.delete(mediaRelations)
    .where(
      inArray(
        mediaRelations.id,
        rows.map((row) => row.id)
      )
    )
    .run()
  if (finalRows.length > 0) {
    db.insert(mediaRelations).values(finalRows).run()
  }
  return sourceCount
}

function nextOrderAfter(orders: number[]): number {
  return orders.reduce((max, order) => Math.max(max, order), -1) + 1
}

export function mergeRelationRows(
  db: DbContext,
  config: RelationMergeConfig,
  targetId: string,
  sourceId: string,
  now: Date
): number {
  const rows = (db as DbQueryContext)
    .select()
    .from(config.table)
    .where(inArray(config.mergeColumn, [targetId, sourceId]))
    .all() as MergeRow[]

  const sourceCount = rows.filter((row) => row[config.mergeField] === sourceId).length
  if (sourceCount === 0) return 0

  const targetRows = rows
    .filter((row) => row[config.mergeField] === targetId)
    .sort((a, b) => compareRelationRows(a, b, config.orderField))
  const sourceRows = rows
    .filter((row) => row[config.mergeField] === sourceId)
    .sort((a, b) => compareRelationRows(a, b, config.orderField))

  const byKey = new Map<string, MergeRow>()
  for (const row of [...targetRows, ...sourceRows]) {
    const normalized = {
      ...row,
      [config.mergeField]: targetId,
      updatedAt: now
    }
    const key = buildRelationKey(normalized, config.uniqueKeyFields)
    const current = byKey.get(key)
    if (!current) {
      byKey.set(key, normalized)
      continue
    }

    mergeDuplicateRelation(current, normalized, config, now)
  }

  const finalRows = [...byKey.values()]
  if (config.orderField) {
    finalRows.forEach((row, index) => {
      row[config.orderField!] = index
    })
  }

  ;(db as DbWriteContext)
    .delete(config.table)
    .where(inArray(config.mergeColumn, [targetId, sourceId]))
    .run()
  if (finalRows.length > 0) {
    ;(db as DbWriteContext).insert(config.table).values(finalRows).run()
  }

  return sourceCount
}

function mergeGameSessions(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const rows = (db as DbQueryContext)
    .select({ id: gameSessions.id })
    .from(gameSessions)
    .where(eq(gameSessions.gameId, sourceId))
    .all()
  if (rows.length === 0) return 0

  db.update(gameSessions)
    .set({ gameId: targetId, updatedAt: now })
    .where(eq(gameSessions.gameId, sourceId))
    .run()
  return rows.length
}

function mergeGameNotes(db: DbContext, targetId: string, sourceId: string, now: Date): number {
  const rows = db
    .select()
    .from(gameNotes)
    .where(inArray(gameNotes.gameId, [targetId, sourceId]))
    .all()

  const targetRows = rows.filter((row) => row.gameId === targetId)
  const sourceRows = rows
    .filter((row) => row.gameId === sourceId)
    .sort((a, b) => a.orderInGame - b.orderInGame || toTime(a.createdAt) - toTime(b.createdAt))
  if (sourceRows.length === 0) return 0

  const usedNames = new Set(targetRows.map((row) => row.name))
  let nextOrder = targetRows.reduce((max, row) => Math.max(max, row.orderInGame), -1) + 1

  for (const note of sourceRows) {
    const name = createMergedNoteName(note.name, usedNames)
    usedNames.add(name)

    db.update(gameNotes)
      .set({
        gameId: targetId,
        name,
        orderInGame: nextOrder++,
        updatedAt: now
      })
      .where(eq(gameNotes.id, note.id))
      .run()
  }

  return sourceRows.length
}

function mergeDuplicateRelation(
  target: MergeRow,
  source: MergeRow,
  config: RelationMergeConfig,
  now: Date
): void {
  if (config.spoilerField) {
    target[config.spoilerField] = Boolean(
      target[config.spoilerField] || source[config.spoilerField]
    )
  }
  if (config.noteField && !hasText(target[config.noteField]) && hasText(source[config.noteField])) {
    target[config.noteField] = source[config.noteField]
  }
  target.updatedAt = now
}

function buildRelationKey(row: MergeRow, fields: string[]): string {
  return fields.map((field) => String(row[field] ?? '')).join('\0')
}

function compareRelationRows(a: MergeRow, b: MergeRow, orderField?: string): number {
  if (orderField) {
    const orderA = typeof a[orderField] === 'number' ? a[orderField] : 0
    const orderB = typeof b[orderField] === 'number' ? b[orderField] : 0
    if (orderA !== orderB) return orderA - orderB
  }

  return toTime(a.createdAt) - toTime(b.createdAt)
}

function toTime(value: unknown): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  return 0
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function createMergedNoteName(name: string, usedNames: Set<string>): string {
  if (!usedNames.has(name)) return name

  const first = `${name} (merged)`
  if (!usedNames.has(first)) return first

  let index = 2
  while (usedNames.has(`${name} (merged ${index})`)) {
    index++
  }
  return `${name} (merged ${index})`
}
