import { eq, inArray } from 'drizzle-orm'
import {
  animeExternalIdLink,
  requireExternalIdsAvailable,
  resolveTagId,
  type DbContext
} from '@main/services/db'
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
  type NewAnime,
  type NewAnimeTagLink
} from '@shared/db'
import { normalizeExternalIds, toExternalIdKey, type ExternalId } from '@shared/identity'
import type { AnimeEpisodeInfo } from '@shared/metadata'
import type {
  AnimeEpisodeUpdatePlan,
  AnimeLinkKind,
  AnimeUpdatePlan,
  UpdateLinkApplyResult
} from '../types'
import { areScalarValuesEqual } from '../shared/merge'
import { applyMediaRelationFacts } from '../../media-relations'
import {
  applyLinkRows,
  filterNodesByIdentity,
  resolveCharacterNodes,
  resolveCompanyNodes,
  resolvePersonNodes
} from './links'

function replaceAnimeExternalIds(tx: DbContext, animeId: string, externalIds: ExternalId[]): void {
  tx.delete(animeExternalIds).where(eq(animeExternalIds.animeId, animeId)).run()

  const values = normalizeExternalIds(externalIds).map((externalId, index) => ({
    animeId,
    source: externalId.source,
    externalId: externalId.id,
    orderInAnime: index
  }))

  if (values.length > 0) {
    tx.insert(animeExternalIds).values(values).run()
  }
}

function replaceAnimeTags(tx: DbContext, animeId: string, nextTags: AnimeUpdatePlan['tags']): void {
  tx.delete(animeTagLinks).where(eq(animeTagLinks.animeId, animeId)).run()
  if (!nextTags?.length) return

  const linkValues: NewAnimeTagLink[] = []
  nextTags.forEach((tag, index) => {
    const tagId = resolveTagId(tx, tag)
    if (!tagId) return

    linkValues.push({
      animeId,
      tagId,
      isSpoiler: tag.isSpoiler ?? false,
      note: tag.note ?? null,
      orderInAnime: index,
      orderInTag: 0
    })
  })

  if (linkValues.length > 0) {
    tx.insert(animeTagLinks).values(linkValues).run()
  }
}

interface EpisodeMatch {
  row: AnimeEpisode
  episode: AnimeEpisodeInfo
  /** Position in the authoritative incoming list, written to `orderInAnime`. */
  order: number
}

/** Scrape-owned metadata refresh; watch state and stills are never touched. */
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
 * watch state (`watchedAt`/`playCount`/`resumePositionMs`/`stillFile`).
 * Unclaimed incoming episodes insert with their identity. Stored rows the
 * source no longer lists are deleted only under `replace` and only when
 * nothing user-owned hangs off them: no watch date, no playable files, no
 * sessions. `merge` never deletes.
 */
function reconcileAnimeEpisodes(
  tx: DbContext,
  animeId: string,
  plan: AnimeEpisodeUpdatePlan
): void {
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
    const key = `${row.type}:${row.episodeNumber}`
    const queue = rowsByNumberKey.get(key) ?? []
    queue.push(row)
    rowsByNumberKey.set(key, queue)
  }

  const inserts: Array<{ episode: AnimeEpisodeInfo; order: number }> = []
  for (const { episode, order } of numberPass) {
    const row = rowsByNumberKey.get(`${episode.type}:${episode.number}`)?.shift()
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
        if (row.watchedAt !== null || referencedIds.has(row.id)) continue
        tx.delete(animeEpisodes).where(eq(animeEpisodes.id, row.id)).run()
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
      insertAnimeEpisodeExternalIds(tx, match.row.id, missingIds, knownKeys.size)
    }
  }

  for (const { episode, order } of inserts) {
    insertAnimeEpisodeRow(tx, animeId, episode, order)
  }
}

function applyAnimeRelationGraph(
  tx: DbContext,
  animeId: string,
  plan: AnimeUpdatePlan,
  persistHandlers: IngestPersistHandlers
): UpdateLinkApplyResult<AnimeLinkKind> {
  const relationGraph = plan.relationGraph
  if (!relationGraph) {
    return { pendingAssets: [], preservedLinkRows: {} }
  }

  const { animePerson, animeCompany, animeCharacter, characterPerson } = plan.links

  const personIdentityKeys = new Set<string>()
  if (animePerson) {
    for (const link of relationGraph.links.animePerson) {
      personIdentityKeys.add(link.personIdentityKey)
    }
  }
  if (characterPerson) {
    for (const link of relationGraph.links.characterPerson) {
      personIdentityKeys.add(link.personIdentityKey)
    }
  }

  const companyIdentityKeys = new Set<string>()
  if (animeCompany) {
    for (const link of relationGraph.links.animeCompany) {
      companyIdentityKeys.add(link.companyIdentityKey)
    }
  }

  const characterIdentityKeys = new Set<string>()
  if (animeCharacter) {
    for (const link of relationGraph.links.animeCharacter) {
      characterIdentityKeys.add(link.characterIdentityKey)
    }
  }
  if (characterPerson) {
    for (const link of relationGraph.links.characterPerson) {
      characterIdentityKeys.add(link.characterIdentityKey)
    }
  }

  const pendingAssets: PendingAssetTask[] = []
  const preservedLinkRows: Partial<Record<AnimeLinkKind, number>> = {}

  const personResolution =
    personIdentityKeys.size > 0
      ? resolvePersonNodes(
          tx,
          persistHandlers,
          filterNodesByIdentity(relationGraph.persons, personIdentityKeys)
        )
      : { idByIdentity: new Map<string, string>(), pendingAssets: [] }
  pendingAssets.push(...personResolution.pendingAssets)

  const companyResolution =
    companyIdentityKeys.size > 0
      ? resolveCompanyNodes(
          tx,
          persistHandlers,
          filterNodesByIdentity(relationGraph.companies, companyIdentityKeys)
        )
      : { idByIdentity: new Map<string, string>(), pendingAssets: [] }
  pendingAssets.push(...companyResolution.pendingAssets)

  const characterResolution =
    characterIdentityKeys.size > 0
      ? resolveCharacterNodes(
          tx,
          persistHandlers,
          filterNodesByIdentity(relationGraph.characters, characterIdentityKeys)
        )
      : { idByIdentity: new Map<string, string>(), pendingAssets: [] }
  pendingAssets.push(...characterResolution.pendingAssets)

  if (animePerson) {
    preservedLinkRows.animePerson = applyLinkRows({
      tx,
      kind: 'animePerson',
      entityId: animeId,
      links: relationGraph.links.animePerson,
      relatedIdentityKeyOf: (link) => link.personIdentityKey,
      relatedIdByIdentity: personResolution.idByIdentity,
      collectionMode: animePerson
    })
  }

  if (animeCompany) {
    preservedLinkRows.animeCompany = applyLinkRows({
      tx,
      kind: 'animeCompany',
      entityId: animeId,
      links: relationGraph.links.animeCompany,
      relatedIdentityKeyOf: (link) => link.companyIdentityKey,
      relatedIdByIdentity: companyResolution.idByIdentity,
      collectionMode: animeCompany
    })
  }

  if (animeCharacter) {
    preservedLinkRows.animeCharacter = applyLinkRows({
      tx,
      kind: 'animeCharacter',
      entityId: animeId,
      links: relationGraph.links.animeCharacter,
      relatedIdentityKeyOf: (link) => link.characterIdentityKey,
      relatedIdByIdentity: characterResolution.idByIdentity,
      collectionMode: animeCharacter
    })
  }

  if (characterPerson) {
    const linksByCharacterId = new Map<string, typeof relationGraph.links.characterPerson>()
    for (const link of relationGraph.links.characterPerson) {
      const characterId = characterResolution.idByIdentity.get(link.characterIdentityKey)
      if (!characterId) continue

      const links = linksByCharacterId.get(characterId) ?? []
      links.push(link)
      linksByCharacterId.set(characterId, links)
    }

    let preserved = 0
    for (const [characterId, links] of linksByCharacterId) {
      preserved += applyLinkRows({
        tx,
        kind: 'characterPerson',
        entityId: characterId,
        links,
        relatedIdentityKeyOf: (link) => link.personIdentityKey,
        relatedIdByIdentity: personResolution.idByIdentity,
        collectionMode: characterPerson
      })
    }
    preservedLinkRows.characterPerson = preserved
  }

  return { pendingAssets, preservedLinkRows }
}

export function applyAnimePlan(
  tx: DbContext,
  animeId: string,
  plan: AnimeUpdatePlan,
  persistHandlers: IngestPersistHandlers
): UpdateLinkApplyResult<AnimeLinkKind> {
  if (plan.externalIds) {
    requireExternalIdsAvailable(tx, animeExternalIdLink, [animeId], plan.externalIds)
    replaceAnimeExternalIds(tx, animeId, plan.externalIds)
  }

  if (plan.tags) {
    replaceAnimeTags(tx, animeId, plan.tags)
  }

  if (Object.keys(plan.patch).length > 0) {
    tx.update(animes)
      .set(plan.patch as Partial<NewAnime>)
      .where(eq(animes.id, animeId))
      .run()
  }

  if (plan.episodes) {
    reconcileAnimeEpisodes(tx, animeId, plan.episodes)
  }

  const plannedMedia: Array<[string, string | undefined]> = [
    ['coverFile', plan.coverUrl],
    ['backdropFile', plan.backdropUrl],
    ['logoFile', plan.logoUrl]
  ]
  const pendingAssets: PendingAssetTask[] = plannedMedia
    .filter(([, url]) => Boolean(url))
    .map(([field, url]) => ({ table: 'animes', rowId: animeId, field, url: url as string }))

  const relations = applyAnimeRelationGraph(tx, animeId, plan, persistHandlers)
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
