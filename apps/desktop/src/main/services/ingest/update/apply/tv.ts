import { eq, inArray } from 'drizzle-orm'
import { requireExternalIdsAvailable, tvExternalIdLink, type DbContext } from '@main/services/db'
import {
  IngestPersistHandlers,
  insertTvEpisodeExternalIds,
  insertTvEpisodeRow
} from '../../persist'
import type { PendingAssetTask } from '../../assets'
import {
  tvEpisodeExternalIds,
  tvEpisodeFiles,
  tvEpisodes,
  tvExternalIds,
  tvSeasons,
  tvSessions,
  tvTagLinks,
  tvs,
  type NewTv,
  type TvEpisode,
  type TvSeason
} from '@shared/db'
import { normalizeExternalIds, toExternalIdKey } from '@shared/identity'
import type { TvEpisodeInfo, TvSeasonInfo } from '@shared/metadata'
import type {
  TvEpisodeUpdatePlan,
  TvLinkKind,
  TvSeasonUpdatePlan,
  TvUpdatePlan,
  UpdateLinkApplyResult
} from '../types'
import { areScalarValuesEqual } from '../shared/merge'
import { applyMediaRelationFacts } from '../../media-relations'
import {
  applyMediaLinkGraph,
  replaceEntityExternalIds,
  replaceEntityTags,
  type ExternalIdRowSpec,
  type TagLinkRowSpec
} from './links'

const TV_EXTERNAL_ID_SPEC: ExternalIdRowSpec = {
  table: tvExternalIds,
  entityIdColumn: tvExternalIds.tvId,
  entityIdField: 'tvId',
  orderField: 'orderInTv'
}

const TV_TAG_LINK_SPEC: TagLinkRowSpec = {
  table: tvTagLinks,
  entityIdColumn: tvTagLinks.tvId,
  entityIdField: 'tvId',
  orderInEntityField: 'orderInTv'
}

/** Scrape-owned metadata refresh; the season poster is never touched. */
function updateMatchedSeason(
  tx: DbContext,
  row: TvSeason,
  season: TvSeasonInfo,
  order: number
): void {
  const patch: Partial<TvSeason> = {}

  if (order !== row.orderInTv) patch.orderInTv = order
  if (season.name !== undefined && season.name !== (row.name ?? undefined)) {
    patch.name = season.name
  }
  if (
    season.originalName !== undefined &&
    season.originalName !== (row.originalName ?? undefined)
  ) {
    patch.originalName = season.originalName
  }
  if (season.airDate !== undefined && !areScalarValuesEqual(row.airDate, season.airDate)) {
    patch.airDate = season.airDate
  }
  if (season.description !== undefined && season.description !== (row.description ?? undefined)) {
    patch.description = season.description
  }
  if (season.totalEpisodes !== undefined && season.totalEpisodes !== row.totalEpisodes) {
    patch.totalEpisodes = season.totalEpisodes
  }

  if (Object.keys(patch).length > 0) {
    tx.update(tvSeasons).set(patch).where(eq(tvSeasons.id, row.id)).run()
  }
}

/**
 * Reconcile stored season rows against the authoritative incoming list.
 *
 * Seasons align by number, the one key every source agrees on. Matched rows
 * refresh scraped metadata but keep their poster. Stored seasons the source no
 * longer lists are deleted only under `replace` and only when empty: a season
 * still holding episodes would take their watch state down with it.
 */
function reconcileTvSeasons(tx: DbContext, tvId: string, plan: TvSeasonUpdatePlan): void {
  const existing = tx.select().from(tvSeasons).where(eq(tvSeasons.tvId, tvId)).all()
  const rowByNumber = new Map(existing.map((row) => [row.seasonNumber, row]))

  const listedNumbers = new Set<number>()
  for (const [order, season] of plan.items.entries()) {
    listedNumbers.add(season.number)

    const row = rowByNumber.get(season.number)
    if (row) {
      updateMatchedSeason(tx, row, season, order)
      continue
    }

    tx.insert(tvSeasons)
      .values({
        tvId,
        seasonNumber: season.number,
        name: season.name,
        originalName: season.originalName,
        airDate: season.airDate,
        description: season.description,
        totalEpisodes: season.totalEpisodes,
        orderInTv: order
      })
      .run()
  }

  if (plan.mode !== 'replace') return

  const leftovers = existing.filter((row) => !listedNumbers.has(row.seasonNumber))
  if (leftovers.length === 0) return

  const occupiedSeasonIds = new Set(
    tx
      .select()
      .from(tvEpisodes)
      .where(
        inArray(
          tvEpisodes.seasonId,
          leftovers.map((row) => row.id)
        )
      )
      .all()
      .map((row) => row.seasonId)
  )

  for (const row of leftovers) {
    if (occupiedSeasonIds.has(row.id)) continue
    tx.delete(tvSeasons).where(eq(tvSeasons.id, row.id)).run()
  }
}

interface EpisodeMatch {
  row: TvEpisode
  episode: TvEpisodeInfo
  seasonId: string
  /** Position within the season, written to `orderInSeason`. */
  orderInSeason: number
  /** Position in the authoritative incoming list, written to `orderInTv`. */
  orderInTv: number
}

/** Scrape-owned metadata refresh; watch state and stills are never touched. */
function updateMatchedEpisode(tx: DbContext, match: EpisodeMatch): void {
  const { row, episode, seasonId, orderInSeason, orderInTv } = match
  const patch: Partial<TvEpisode> = {}

  // Realignment is the point: an id-matched row takes the source's current
  // season and numbering. Fields the source omitted stay as stored, because
  // episode fields carry no known-empty marker.
  if (seasonId !== row.seasonId) patch.seasonId = seasonId
  if (episode.number !== row.episodeNumber) patch.episodeNumber = episode.number
  if (orderInSeason !== row.orderInSeason) patch.orderInSeason = orderInSeason
  if (orderInTv !== row.orderInTv) patch.orderInTv = orderInTv
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
    tx.update(tvEpisodes).set(patch).where(eq(tvEpisodes.id, row.id)).run()
  }
}

/**
 * Season rows the incoming episodes need, creating the missing ones.
 *
 * Seasons and episodes are separate surfaces, so an episodes-only update can
 * name a season no stored row covers; the episode still needs somewhere to
 * hang, so a bare season row stands in until the seasons surface fills it.
 */
function resolveSeasonIds(
  tx: DbContext,
  tvId: string,
  seasonNumbers: Iterable<number>
): Map<number, string> {
  const seasonIdByNumber = new Map(
    tx
      .select()
      .from(tvSeasons)
      .where(eq(tvSeasons.tvId, tvId))
      .all()
      .map((row) => [row.seasonNumber, row.id] as const)
  )

  let nextOrder = seasonIdByNumber.size
  for (const seasonNumber of seasonNumbers) {
    if (seasonIdByNumber.has(seasonNumber)) continue

    const inserted = tx
      .insert(tvSeasons)
      .values({ tvId, seasonNumber, orderInTv: nextOrder++ })
      .returning({ id: tvSeasons.id })
      .all()[0]
    seasonIdByNumber.set(seasonNumber, inserted.id)
  }

  return seasonIdByNumber
}

/**
 * Reconcile stored episode rows against the authoritative incoming list.
 *
 * Incoming episodes claim stored rows by shared external id first, then by
 * (season, episodeNumber) for rows no id claimed; sources revise numbering, so
 * identity outranks position. Matched rows refresh scraped metadata but never
 * watch state (`watched`/`watchedAt`/`playCount`/`resumePositionMs`/`stillFile`).
 * Unclaimed incoming episodes insert with their identity. Stored rows the
 * source no longer lists are deleted only under `replace` and only when
 * nothing user-owned hangs off them: not watched, no playable files, no
 * sessions. `merge` never deletes.
 */
function reconcileTvEpisodes(tx: DbContext, tvId: string, plan: TvEpisodeUpdatePlan): void {
  const seasonIdByNumber = resolveSeasonIds(
    tx,
    tvId,
    plan.items.map((episode) => episode.seasonNumber)
  )

  const existing = tx.select().from(tvEpisodes).where(eq(tvEpisodes.tvId, tvId)).all()
  const existingIds = existing.map((row) => row.id)
  const idRows = existingIds.length
    ? tx
        .select()
        .from(tvEpisodeExternalIds)
        .where(inArray(tvEpisodeExternalIds.episodeId, existingIds))
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

  const orderInSeasonCounters = new Map<number, number>()
  const nextOrderInSeason = (seasonNumber: number): number => {
    const order = orderInSeasonCounters.get(seasonNumber) ?? 0
    orderInSeasonCounters.set(seasonNumber, order + 1)
    return order
  }

  const rowById = new Map(existing.map((row) => [row.id, row]))
  const claimedRowIds = new Set<string>()
  const matches: EpisodeMatch[] = []
  const numberPass: Array<{
    episode: TvEpisodeInfo
    seasonId: string
    orderInSeason: number
    orderInTv: number
  }> = []

  for (const [orderInTv, episode] of plan.items.entries()) {
    const seasonId = seasonIdByNumber.get(episode.seasonNumber)
    if (!seasonId) continue
    const orderInSeason = nextOrderInSeason(episode.seasonNumber)

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
      matches.push({
        row: rowById.get(claimedId) as TvEpisode,
        episode,
        seasonId,
        orderInSeason,
        orderInTv
      })
    } else {
      numberPass.push({ episode, seasonId, orderInSeason, orderInTv })
    }
  }

  const rowsByNumberKey = new Map<string, TvEpisode[]>()
  for (const row of existing) {
    if (claimedRowIds.has(row.id) || row.episodeNumber === null) continue
    const key = `${row.seasonId}:${row.episodeNumber}`
    const queue = rowsByNumberKey.get(key) ?? []
    queue.push(row)
    rowsByNumberKey.set(key, queue)
  }

  const inserts: Array<{
    episode: TvEpisodeInfo
    seasonId: string
    orderInSeason: number
    orderInTv: number
  }> = []
  for (const pending of numberPass) {
    const row = rowsByNumberKey.get(`${pending.seasonId}:${pending.episode.number}`)?.shift()
    if (row) {
      claimedRowIds.add(row.id)
      matches.push({ ...pending, row })
    } else {
      inserts.push(pending)
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
          .from(tvEpisodeFiles)
          .where(inArray(tvEpisodeFiles.episodeId, leftoverIds))
          .all()
          .map((row) => row.episodeId),
        ...tx
          .select()
          .from(tvSessions)
          .where(inArray(tvSessions.episodeId, leftoverIds))
          .all()
          .flatMap((row) => (row.episodeId ? [row.episodeId] : []))
      ])

      for (const row of leftovers) {
        if (row.watched || referencedIds.has(row.id)) continue
        tx.delete(tvEpisodes).where(eq(tvEpisodes.id, row.id)).run()
      }
    }
  }

  for (const match of matches) {
    updateMatchedEpisode(tx, match)

    const knownKeys = externalKeysByEpisodeId.get(match.row.id) ?? new Set<string>()
    const missingIds = normalizeExternalIds(match.episode.externalIds).filter(
      (extId) => !knownKeys.has(toExternalIdKey(extId))
    )
    if (missingIds.length > 0) {
      insertTvEpisodeExternalIds(tx, match.row.id, missingIds, knownKeys.size)
    }
  }

  for (const insert of inserts) {
    insertTvEpisodeRow(tx, { tvId, ...insert })
  }
}

export function applyTvPlan(
  tx: DbContext,
  tvId: string,
  plan: TvUpdatePlan,
  persistHandlers: IngestPersistHandlers
): UpdateLinkApplyResult<TvLinkKind> {
  if (plan.externalIds) {
    requireExternalIdsAvailable(tx, tvExternalIdLink, [tvId], plan.externalIds)
    replaceEntityExternalIds(tx, TV_EXTERNAL_ID_SPEC, tvId, plan.externalIds)
  }

  if (plan.tags) {
    replaceEntityTags(tx, TV_TAG_LINK_SPEC, tvId, plan.tags)
  }

  if (Object.keys(plan.patch).length > 0) {
    tx.update(tvs)
      .set(plan.patch as Partial<NewTv>)
      .where(eq(tvs.id, tvId))
      .run()
  }

  // Seasons go first so the episode pass finds the rows it hangs from.
  if (plan.seasons) {
    reconcileTvSeasons(tx, tvId, plan.seasons)
  }

  if (plan.episodes) {
    reconcileTvEpisodes(tx, tvId, plan.episodes)
  }

  const plannedMedia: Array<[string, string | undefined]> = [
    ['coverFile', plan.coverUrl],
    ['backdropFile', plan.backdropUrl],
    ['logoFile', plan.logoUrl]
  ]
  const pendingAssets: PendingAssetTask[] = plannedMedia
    .filter(([, url]) => Boolean(url))
    .map(([field, url]) => ({ table: 'tvs', rowId: tvId, field, url: url as string }))

  const relationGraph = plan.relationGraph
  const relations = relationGraph
    ? applyMediaLinkGraph({
        tx,
        entityId: tvId,
        persistHandlers,
        nodes: relationGraph,
        person: {
          kind: 'tvPerson',
          mode: plan.links.tvPerson,
          links: relationGraph.links.tvPerson
        },
        company: {
          kind: 'tvCompany',
          mode: plan.links.tvCompany,
          links: relationGraph.links.tvCompany
        },
        character: {
          kind: 'tvCharacter',
          mode: plan.links.tvCharacter,
          links: relationGraph.links.tvCharacter
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
      mediaType: 'tv',
      entityId: tvId,
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
