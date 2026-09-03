/**
 * Bidirectional media-relation reads.
 *
 * Rows are stored as directed edges; this reader merges outgoing edges (label
 * as stored) with incoming edges (label through the inverse vocabulary), so a
 * half-written pair stays visible from both endpoints. Duplicate pairs (both
 * directions stored) collapse onto the outgoing row, and a kind subsumed by a
 * more specific edge to the same target is dropped.
 */
import { and, asc, eq, inArray } from 'drizzle-orm'

import type { MediaType } from '@shared/entity-types'
import type { TableName } from '@shared/db/table-names'
import {
  MEDIA_RELATION_TYPE_INVERSE,
  collapseSubsumedMediaRelations,
  mediaRelations,
  type Anime,
  type Comic,
  type Game,
  type MediaRelation,
  type MediaRelationEdgeView,
  type MediaRelationType,
  type Novel
} from '@shared/db'
import { animes, comics, games, novels } from '@shared/db'
import { db } from './proxy'

/**
 * The entry a relation points at, paired with its media type.
 *
 * The pair is a union rather than one nullable field per media type, so a
 * reader that handles every member is provably complete.
 */
export type MediaRelationTarget =
  | { mediaType: 'game'; entity: Game }
  | { mediaType: 'anime'; entity: Anime }
  | { mediaType: 'comic'; entity: Comic }
  | { mediaType: 'novel'; entity: Novel }

/** One display-ready relation entry of an entity, either edge direction. */
export interface MediaRelationEntry {
  /** Stored edge row id; in-edges share the id of the row on the other side. */
  id: string
  /** Relation type as seen from this entity (in-edges carry the inverse label). */
  type: MediaRelationType
  direction: 'out' | 'in'
  note: string | null
  target: MediaRelationTarget
}

/** An edge resolved down to its endpoint, before the endpoint row is loaded. */
interface MediaRelationEdge {
  id: string
  type: MediaRelationType
  direction: 'out' | 'in'
  note: string | null
  targetType: MediaType
  targetId: string
}

/**
 * Tables `fetchMediaRelations` reads: the edges, and the endpoint rows of
 * every media type an edge can point at. Detail specs include this in their
 * table declaration.
 */
export const MEDIA_RELATION_TABLES: readonly TableName[] = [
  'media_relations',
  'games',
  'animes',
  'comics',
  'novels'
]

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

  const edges: MediaRelationEdge[] = []
  const seen = new Set<string>()

  const push = (row: MediaRelation, direction: 'out' | 'in'): void => {
    const targetType = direction === 'out' ? row.toType : row.fromType
    const targetId = direction === 'out' ? row.toId : row.fromId
    const type = direction === 'out' ? row.type : MEDIA_RELATION_TYPE_INVERSE[row.type]
    const key = `${targetType}\0${targetId}\0${type}`
    if (seen.has(key)) return

    seen.add(key)
    edges.push({ id: row.id, type, direction, note: row.note, targetType, targetId })
  }

  for (const row of outRows) push(row, 'out')
  for (const row of inRows) push(row, 'in')

  return attachTargets(collapseSubsumedMediaRelations(edges, readEdgeView), showNsfw)
}

function readEdgeView(edge: MediaRelationEdge): MediaRelationEdgeView {
  return { type: edge.type, targetType: edge.targetType, targetId: edge.targetId }
}

/** Endpoint rows load one query per media type, then pair back onto their edge. */
async function attachTargets(
  edges: MediaRelationEdge[],
  showNsfw: boolean
): Promise<MediaRelationEntry[]> {
  if (edges.length === 0) return []

  const idsByType = new Map<MediaType, string[]>()
  for (const edge of edges) {
    const ids = idsByType.get(edge.targetType) ?? []
    ids.push(edge.targetId)
    idsByType.set(edge.targetType, ids)
  }

  const [gameRows, animeRows, comicRows, novelRows] = await Promise.all([
    loadGameTargets(idsByType.get('game'), showNsfw),
    loadAnimeTargets(idsByType.get('anime'), showNsfw),
    loadComicTargets(idsByType.get('comic'), showNsfw),
    loadNovelTargets(idsByType.get('novel'), showNsfw)
  ])

  const targetsByType = {
    game: new Map(gameRows.map((row) => [row.id, row])),
    anime: new Map(animeRows.map((row) => [row.id, row])),
    comic: new Map(comicRows.map((row) => [row.id, row])),
    novel: new Map(novelRows.map((row) => [row.id, row]))
  }

  // Targets hidden by the NSFW preference, and ids left behind by a deleted
  // entry, drop their edges entirely.
  return edges.flatMap((edge): MediaRelationEntry[] => {
    const target = readTarget(edge, targetsByType)
    return target
      ? [{ id: edge.id, type: edge.type, direction: edge.direction, note: edge.note, target }]
      : []
  })
}

interface TargetsByType {
  game: Map<string, Game>
  anime: Map<string, Anime>
  comic: Map<string, Comic>
  novel: Map<string, Novel>
}

function readTarget(edge: MediaRelationEdge, targets: TargetsByType): MediaRelationTarget | null {
  switch (edge.targetType) {
    case 'game': {
      const entity = targets.game.get(edge.targetId)
      return entity ? { mediaType: 'game', entity } : null
    }
    case 'anime': {
      const entity = targets.anime.get(edge.targetId)
      return entity ? { mediaType: 'anime', entity } : null
    }
    case 'comic': {
      const entity = targets.comic.get(edge.targetId)
      return entity ? { mediaType: 'comic', entity } : null
    }
    case 'novel': {
      const entity = targets.novel.get(edge.targetId)
      return entity ? { mediaType: 'novel', entity } : null
    }
  }
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

async function loadComicTargets(ids: string[] | undefined, showNsfw: boolean): Promise<Comic[]> {
  if (!ids?.length) return []
  return db
    .select()
    .from(comics)
    .where(and(inArray(comics.id, ids), showNsfw ? undefined : eq(comics.isNsfw, false)))
}

async function loadNovelTargets(ids: string[] | undefined, showNsfw: boolean): Promise<Novel[]> {
  if (!ids?.length) return []
  return db
    .select()
    .from(novels)
    .where(and(inArray(novels.id, ids), showNsfw ? undefined : eq(novels.isNsfw, false)))
}
