/**
 * Bidirectional media-relation reads.
 *
 * Rows are stored as directed edges; this reader merges outgoing edges (label
 * as stored) with incoming edges (label through the inverse vocabulary), so a
 * half-written pair stays visible from both endpoints. Duplicate pairs (both
 * directions stored) collapse onto the outgoing row.
 */
import { and, asc, eq, inArray } from 'drizzle-orm'

import type { MediaType } from '@shared/common'
import {
  MEDIA_RELATION_TYPE_INVERSE,
  mediaRelations,
  type Anime,
  type Game,
  type MediaRelation,
  type MediaRelationType
} from '@shared/db'
import { animes, games } from '@shared/db'
import { db } from './proxy'

/** One display-ready relation entry of an entity, either edge direction. */
export interface MediaRelationEntry {
  /** Stored edge row id; in-edges share the id of the row on the other side. */
  id: string
  /** Relation type as seen from this entity (in-edges carry the inverse label). */
  type: MediaRelationType
  direction: 'out' | 'in'
  note: string | null
  target: { mediaType: MediaType; id: string }
  targetGame: Game | null
  targetAnime: Anime | null
}

export async function fetchMediaRelations(
  mediaType: MediaType,
  entityId: string,
  showNsfw: boolean
): Promise<MediaRelationEntry[]> {
  const [outRows, inRows] = await Promise.all([
    db
      .select()
      .from(mediaRelations)
      .where(and(eq(mediaRelations.fromType, mediaType), eq(mediaRelations.fromId, entityId)))
      .orderBy(asc(mediaRelations.orderInFrom), asc(mediaRelations.createdAt)),
    db
      .select()
      .from(mediaRelations)
      .where(and(eq(mediaRelations.toType, mediaType), eq(mediaRelations.toId, entityId)))
      .orderBy(asc(mediaRelations.createdAt))
  ])

  const entries: MediaRelationEntry[] = []
  const seen = new Set<string>()

  const push = (row: MediaRelation, direction: 'out' | 'in'): void => {
    const target =
      direction === 'out'
        ? { mediaType: row.toType, id: row.toId }
        : { mediaType: row.fromType, id: row.fromId }
    const type = direction === 'out' ? row.type : MEDIA_RELATION_TYPE_INVERSE[row.type]
    const key = `${target.mediaType}\0${target.id}\0${type}`
    if (seen.has(key)) return

    seen.add(key)
    entries.push({
      id: row.id,
      type,
      direction,
      note: row.note,
      target,
      targetGame: null,
      targetAnime: null
    })
  }

  for (const row of outRows) push(row, 'out')
  for (const row of inRows) push(row, 'in')
  if (entries.length === 0) return []

  const idsByType = new Map<MediaType, string[]>()
  for (const entry of entries) {
    const ids = idsByType.get(entry.target.mediaType) ?? []
    ids.push(entry.target.id)
    idsByType.set(entry.target.mediaType, ids)
  }

  const [gameRows, animeRows] = await Promise.all([
    loadGameTargets(idsByType.get('game'), showNsfw),
    loadAnimeTargets(idsByType.get('anime'), showNsfw)
  ])
  const gameById = new Map(gameRows.map((row) => [row.id, row]))
  const animeById = new Map(animeRows.map((row) => [row.id, row]))

  // Targets hidden by the NSFW preference drop their entries entirely.
  return entries.flatMap((entry): MediaRelationEntry[] => {
    if (entry.target.mediaType === 'game') {
      const targetGame = gameById.get(entry.target.id)
      return targetGame ? [{ ...entry, targetGame }] : []
    }
    const targetAnime = animeById.get(entry.target.id)
    return targetAnime ? [{ ...entry, targetAnime }] : []
  })
}

async function loadGameTargets(ids: string[] | undefined, showNsfw: boolean): Promise<Game[]> {
  if (!ids?.length) return []
  return db
    .select()
    .from(games)
    .where(and(inArray(games.id, ids), showNsfw ? undefined : eq(games.isNsfw, false)))
}

async function loadAnimeTargets(ids: string[] | undefined, showNsfw: boolean): Promise<Anime[]> {
  if (!ids?.length) return []
  return db
    .select()
    .from(animes)
    .where(and(inArray(animes.id, ids), showNsfw ? undefined : eq(animes.isNsfw, false)))
}
