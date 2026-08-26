import { eq, inArray } from 'drizzle-orm'
import { animeExternalIdLink, requireExternalIdsAvailable, type DbContext } from '@main/services/db'
import {
  IngestPersistHandlers,
  insertAnimeEpisodeExternalIds,
  insertAnimeEpisodeRow
} from '../../persist'
import type { PendingAssetTask } from '../../assets'
import {
  animeEpisodeExternalIds,
  animeEpisodeFiles,
  animeEpisodes,
  animeExternalIds,
  animeSessions,
  animeTagLinks,
  animes,
  type AnimeEpisode,
  type NewAnime
} from '@shared/db'
import { normalizeExternalIds, toExternalIdKey } from '@shared/identity'
import { animeUnitIdentityKey, type AnimeEpisodeInfo } from '@shared/metadata'
import type { AnimeEpisodeUpdatePlan, AnimeLinkKind, AnimeUpdatePlan } from './types'
import type { UpdateLinkApplyResult } from '../types'
import { areScalarValuesEqual } from '../shared/merge'
import { applyMediaRelationFacts } from '../../persist/media-relations'
import {
  applyMediaLinkGraph,
  replaceEntityExternalIds,
  replaceEntityTags,
  type ExternalIdRowSpec,
  type TagLinkRowSpec
} from '../shared/links'

const ANIME_EXTERNAL_ID_SPEC: ExternalIdRowSpec = {
  table: animeExternalIds,
  entityIdColumn: animeExternalIds.animeId,
  entityIdField: 'animeId',
  orderField: 'orderInAnime'
}

const ANIME_TAG_LINK_SPEC: TagLinkRowSpec = {
  table: animeTagLinks,
  entityIdColumn: animeTagLinks.animeId,
  entityIdField: 'animeId',
  orderInEntityField: 'orderInAnime'
}

interface EpisodeMatch {
  row: AnimeEpisode
  episode: AnimeEpisodeInfo
  /** Position in the authoritative incoming list, written to `orderInAnime`. */
  order: number
}

/** Scrape-owned metadata refresh; watch state is never touched. */
function updateMatchedEpisode(tx: DbContext, match: EpisodeMatch): void {
  const { row, episode, order } = match
  const patch: Partial<AnimeEpisode> = {}

  // Realignment is the point: an id-matched row takes the source's current
  // numbering. Fields the source omitted stay as stored, because episode
  // fields carry no known-empty marker.
  if (episode.number !== row.episodeNumber) patch.episodeNumber = episode.number
  if (order !== row.orderInAnime) patch.orderInAnime = order
  if (episode.name !== undefined && episode.name !== (row.name ?? undefined)) {
    patch.name = episode.name
  }
  if (
    episode.originalName !== undefined &&
    episode.originalName !== (row.originalName ?? undefined)
  ) {
    patch.originalName = episode.originalName
  }
  if (episode.airDate !== undefined && !areScalarValuesEqual(row.airDate, episode.airDate)) {
    patch.airDate = episode.airDate
  }
  if (episode.description !== undefined && episode.description !== (row.description ?? undefined)) {
    patch.description = episode.description
  }
  if (episode.durationMs !== undefined && episode.durationMs !== row.durationMs) {
    patch.durationMs = episode.durationMs
  }

  if (Object.keys(patch).length > 0) {
    tx.update(animeEpisodes).set(patch).where(eq(animeEpisodes.id, row.id)).run()
  }
}

/**
 * Reconcile stored episode rows against the authoritative incoming list.
 *
 * Incoming episodes claim stored rows by shared external id first, then by
 * (type, episodeNumber) for rows no id claimed; sources revise numbering, so
 * identity outranks position. Matched rows refresh scraped metadata but never
 * watch state (`watched`/`watchedAt`/`playCount`/`resumePositionMs`).
 * Unclaimed incoming episodes insert with their identity. Stored rows the
 * source no longer lists are deleted only under `replace` and only when
 * nothing user-owned hangs off them: not watched, no playable files, no
 * sessions. `merge` never deletes.
 *
 * Stills are filled, never replaced: a stored `stillFile` outranks any scrape,
 * so the returned tasks only cover new rows and rows that still have none.
 */
function reconcileAnimeEpisodes(
  tx: DbContext,
  animeId: string,
  plan: AnimeEpisodeUpdatePlan
): PendingAssetTask[] {
  const existing = tx.select().from(animeEpisodes).where(eq(animeEpisodes.animeId, animeId)).all()
  const existingIds = existing.map((row) => row.id)
  const idRows = existingIds.length
    ? tx
        .select()
        .from(animeEpisodeExternalIds)
        .where(inArray(animeEpisodeExternalIds.episodeId, existingIds))
        .all()
    : []

  const episodeIdByExternalKey = new Map<string, string>()
  const externalKeysByEpisodeId = new Map<string, Set<string>>()
  for (const row of idRows) {
    const key = toExternalIdKey({ source: row.source, id: row.externalId })
    if (!episodeIdByExternalKey.has(key)) {
      episodeIdByExternalKey.set(key, row.episodeId)
    }
    const keys = externalKeysByEpisodeId.get(row.episodeId) ?? new Set<string>()
    keys.add(key)
    externalKeysByEpisodeId.set(row.episodeId, keys)
  }

  const rowById = new Map(existing.map((row) => [row.id, row]))
  const claimedRowIds = new Set<string>()
  const matches: EpisodeMatch[] = []
  const numberPass: Array<{ episode: AnimeEpisodeInfo; order: number }> = []

  for (const [order, episode] of plan.items.entries()) {
    let claimedId: string | undefined
    for (const extId of normalizeExternalIds(episode.externalIds)) {
      const candidate = episodeIdByExternalKey.get(toExternalIdKey(extId))
      if (candidate && !claimedRowIds.has(candidate)) {
        claimedId = candidate
        break
      }
    }

    if (claimedId) {
      claimedRowIds.add(claimedId)
      matches.push({ row: rowById.get(claimedId) as AnimeEpisode, episode, order })
    } else {
      numberPass.push({ episode, order })
    }
  }

  const rowsByNumberKey = new Map<string, AnimeEpisode[]>()
  for (const row of existing) {
    if (claimedRowIds.has(row.id) || row.episodeNumber === null) continue
    const key = animeUnitIdentityKey({ type: row.type, episodeNumber: row.episodeNumber })
    const queue = rowsByNumberKey.get(key) ?? []
    queue.push(row)
    rowsByNumberKey.set(key, queue)
  }

  const inserts: Array<{ episode: AnimeEpisodeInfo; order: number }> = []
  for (const { episode, order } of numberPass) {
    const row = rowsByNumberKey
      .get(animeUnitIdentityKey({ type: episode.type, episodeNumber: episode.number }))
      ?.shift()
    if (row) {
      claimedRowIds.add(row.id)
      matches.push({ row, episode, order })
    } else {
      inserts.push({ episode, order })
    }
  }

  // Deletions run first so identities freed by removed rows can re-attach to
  // the rows the source now lists (episode ids are globally unique).
  if (plan.mode === 'replace') {
    const leftovers = existing.filter((row) => !claimedRowIds.has(row.id))
    if (leftovers.length > 0) {
      const leftoverIds = leftovers.map((row) => row.id)
      const referencedIds = new Set<string>([
        ...tx
          .select()
          .from(animeEpisodeFiles)
          .where(inArray(animeEpisodeFiles.episodeId, leftoverIds))
          .all()
          .map((row) => row.episodeId),
        ...tx
          .select()
          .from(animeSessions)
          .where(inArray(animeSessions.episodeId, leftoverIds))
          .all()
          .flatMap((row) => (row.episodeId ? [row.episodeId] : []))
      ])

      for (const row of leftovers) {
        if (row.watched || referencedIds.has(row.id)) continue
        tx.delete(animeEpisodes).where(eq(animeEpisodes.id, row.id)).run()
      }
    }
  }

  const pendingAssets: PendingAssetTask[] = []

  for (const match of matches) {
    updateMatchedEpisode(tx, match)

    const knownKeys = externalKeysByEpisodeId.get(match.row.id) ?? new Set<string>()
    const missingIds = normalizeExternalIds(match.episode.externalIds).filter(
      (extId) => !knownKeys.has(toExternalIdKey(extId))
    )
    if (missingIds.length > 0) {
      insertAnimeEpisodeExternalIds(tx, match.row.id, missingIds, knownKeys.size)
    }

    if (match.row.stillFile === null && match.episode.stillUrl) {
      pendingAssets.push(toEpisodeStillTask(match.row.id, match.episode.stillUrl))
    }
  }

  for (const { episode, order } of inserts) {
    const episodeId = insertAnimeEpisodeRow(tx, animeId, episode, order)
    if (episode.stillUrl) {
      pendingAssets.push(toEpisodeStillTask(episodeId, episode.stillUrl))
    }
  }

  return pendingAssets
}

function toEpisodeStillTask(episodeId: string, url: string): PendingAssetTask {
  return { table: 'anime_episodes', rowId: episodeId, field: 'stillFile', url }
}

export function applyAnimePlan(
  tx: DbContext,
  animeId: string,
  plan: AnimeUpdatePlan,
  persistHandlers: IngestPersistHandlers
): UpdateLinkApplyResult<AnimeLinkKind> {
  if (plan.externalIds) {
    requireExternalIdsAvailable(tx, animeExternalIdLink, [animeId], plan.externalIds)
    replaceEntityExternalIds(tx, ANIME_EXTERNAL_ID_SPEC, animeId, plan.externalIds)
  }

  if (plan.tags) {
    replaceEntityTags(tx, ANIME_TAG_LINK_SPEC, animeId, plan.tags)
  }

  if (Object.keys(plan.patch).length > 0) {
    tx.update(animes)
      .set(plan.patch as Partial<NewAnime>)
      .where(eq(animes.id, animeId))
      .run()
  }

  const episodeAssets = plan.episodes ? reconcileAnimeEpisodes(tx, animeId, plan.episodes) : []

  const plannedMedia: Array<[string, string | undefined]> = [
    ['coverFile', plan.coverUrl],
    ['backdropFile', plan.backdropUrl],
    ['logoFile', plan.logoUrl]
  ]
  const pendingAssets: PendingAssetTask[] = plannedMedia
    .filter(([, url]) => Boolean(url))
    .map(([field, url]) => ({ table: 'animes', rowId: animeId, field, url: url as string }))
  pendingAssets.push(...episodeAssets)

  const relationGraph = plan.relationGraph
  const relations = relationGraph
    ? applyMediaLinkGraph({
        tx,
        entityId: animeId,
        persistHandlers,
        nodes: relationGraph,
        person: {
          kind: 'animePerson',
          mode: plan.links.animePerson,
          links: relationGraph.links.animePerson
        },
        company: {
          kind: 'animeCompany',
          mode: plan.links.animeCompany,
          links: relationGraph.links.animeCompany
        },
        character: {
          kind: 'animeCharacter',
          mode: plan.links.animeCharacter,
          links: relationGraph.links.animeCharacter
        },
        cast: {
          kind: 'animeCast',
          mode: plan.links.animeCast,
          links: relationGraph.links.animeCast
        },
        characterPerson: {
          mode: plan.links.characterPerson,
          links: relationGraph.links.characterPerson
        }
      })
    : { pendingAssets: [] as PendingAssetTask[], preservedLinkRows: {} }
  pendingAssets.push(...relations.pendingAssets)

  let unresolvedRelatedEntries: number | undefined
  if (plan.relatedEntries) {
    const relatedResult = applyMediaRelationFacts({
      tx,
      mediaType: 'anime',
      entityId: animeId,
      facts: plan.relatedEntries.facts,
      collectionMode: plan.relatedEntries.mode
    })
    if (relatedResult.unresolvedCount > 0) {
      unresolvedRelatedEntries = relatedResult.unresolvedCount
    }
  }

  return {
    pendingAssets,
    preservedLinkRows: relations.preservedLinkRows,
    ...(unresolvedRelatedEntries !== undefined && { unresolvedRelatedEntries })
  }
}
