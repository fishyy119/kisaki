import type { CharacterPersonRole, TvCharacterRole, TvCompanyRole, TvPersonRole } from '@shared/db'
import { buildEntityCanonicalIdentityKey } from '@shared/identity'
import type {
  CoreCharacterMetadata,
  CoreCompanyMetadata,
  CorePersonMetadata,
  CoreTvMetadata,
  TvEpisodeInfo,
  TvSeasonInfo
} from '@shared/metadata'
import type {
  IngestCharacterNode,
  IngestCharacterPersonLink,
  IngestCompanyNode,
  IngestPersonNode,
  IngestTvCharacterLink,
  IngestTvCompanyLink,
  IngestTvGraph,
  IngestTvPersonLink
} from './types'
import type {
  ScrapedCharacterPersonFact,
  ScrapedTvBundle,
  ScrapedTvCharacterFact,
  ScrapedTvCompanyFact,
  ScrapedTvPersonFact,
  ScraperLookup
} from '@shared/scraper'
import {
  compareText,
  createIdentityAliasIndex,
  firstNonEmpty,
  mergeExternalIds,
  normalizeCharacterCore,
  normalizeCompanyCore,
  normalizeOptionalString,
  normalizePersonCore,
  normalizeTvCore,
  pickFirstUrl,
  upsertCharacterNode,
  upsertCompanyNode,
  upsertPersonNode
} from './common'

interface PendingTvPersonLink {
  personIdentityKey: string
  role: TvPersonRole
  isSpoiler: boolean
  note?: string
}

interface PendingTvCompanyLink {
  companyIdentityKey: string
  role: TvCompanyRole
  isSpoiler: boolean
  note?: string
}

interface PendingTvCharacterLink {
  characterIdentityKey: string
  role: TvCharacterRole
  isSpoiler: boolean
  note?: string
}

interface PendingCharacterPersonLink {
  characterIdentityKey: string
  personIdentityKey: string
  role: CharacterPersonRole
  isSpoiler: boolean
  note?: string
}

/**
 * Coarsen a cast credit into the tv crew vocabulary.
 *
 * Live-action credit lists have no design roles, so only performance carries a
 * matching crew role; the rest land in `other`.
 */
function toTvPersonRoleFromCharacterPerson(role: CharacterPersonRole): TvPersonRole {
  switch (role) {
    case 'actor':
      return 'actor'
    case 'illustration':
    case 'designer':
    case 'other':
      return 'other'
  }
}

function upsertTvPersonLink(
  edgeMap: Map<string, PendingTvPersonLink>,
  personIdentityKey: string,
  role: TvPersonRole,
  isSpoiler: boolean | undefined,
  note: string | undefined
): void {
  const key = `${personIdentityKey}:${role}`
  const existing = edgeMap.get(key)
  if (!existing) {
    edgeMap.set(key, {
      personIdentityKey,
      role,
      isSpoiler: !!isSpoiler,
      note: normalizeOptionalString(note)
    })
    return
  }

  existing.isSpoiler = existing.isSpoiler || !!isSpoiler
  existing.note = firstNonEmpty(existing.note, note)
}

function upsertTvCompanyLink(
  edgeMap: Map<string, PendingTvCompanyLink>,
  companyIdentityKey: string,
  role: TvCompanyRole,
  isSpoiler: boolean | undefined,
  note: string | undefined
): void {
  const key = `${companyIdentityKey}:${role}`
  const existing = edgeMap.get(key)
  if (!existing) {
    edgeMap.set(key, {
      companyIdentityKey,
      role,
      isSpoiler: !!isSpoiler,
      note: normalizeOptionalString(note)
    })
    return
  }

  existing.isSpoiler = existing.isSpoiler || !!isSpoiler
  existing.note = firstNonEmpty(existing.note, note)
}

function upsertTvCharacterLink(
  edgeMap: Map<string, PendingTvCharacterLink>,
  characterIdentityKey: string,
  role: TvCharacterRole,
  isSpoiler: boolean | undefined,
  note: string | undefined
): void {
  const key = `${characterIdentityKey}:${role}`
  const existing = edgeMap.get(key)
  if (!existing) {
    edgeMap.set(key, {
      characterIdentityKey,
      role,
      isSpoiler: !!isSpoiler,
      note: normalizeOptionalString(note)
    })
    return
  }

  existing.isSpoiler = existing.isSpoiler || !!isSpoiler
  existing.note = firstNonEmpty(existing.note, note)
}

function upsertCharacterPersonLink(
  edgeMap: Map<string, PendingCharacterPersonLink>,
  characterIdentityKey: string,
  personIdentityKey: string,
  role: ScrapedCharacterPersonFact['role'],
  isSpoiler: boolean | undefined,
  note: string | undefined
): void {
  const key = `${characterIdentityKey}:${personIdentityKey}:${role}`
  const existing = edgeMap.get(key)
  if (!existing) {
    edgeMap.set(key, {
      characterIdentityKey,
      personIdentityKey,
      role,
      isSpoiler: !!isSpoiler,
      note: normalizeOptionalString(note)
    })
    return
  }

  existing.isSpoiler = existing.isSpoiler || !!isSpoiler
  existing.note = firstNonEmpty(existing.note, note)
}

function finalizeTvPersonLinks(
  tvIdentityKey: string,
  edgeMap: Map<string, PendingTvPersonLink>
): IngestTvPersonLink[] {
  // Map iteration keeps the merged relation order from scraper results.
  const personOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge, orderInTv) => {
    const orderInPerson = personOrderCounters.get(edge.personIdentityKey) ?? 0
    personOrderCounters.set(edge.personIdentityKey, orderInPerson + 1)

    return {
      tvIdentityKey,
      personIdentityKey: edge.personIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInTv,
      orderInPerson
    }
  })
}

function finalizeTvCompanyLinks(
  tvIdentityKey: string,
  edgeMap: Map<string, PendingTvCompanyLink>
): IngestTvCompanyLink[] {
  const companyOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge, orderInTv) => {
    const orderInCompany = companyOrderCounters.get(edge.companyIdentityKey) ?? 0
    companyOrderCounters.set(edge.companyIdentityKey, orderInCompany + 1)

    return {
      tvIdentityKey,
      companyIdentityKey: edge.companyIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInTv,
      orderInCompany
    }
  })
}

function finalizeTvCharacterLinks(
  tvIdentityKey: string,
  edgeMap: Map<string, PendingTvCharacterLink>
): IngestTvCharacterLink[] {
  const characterOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge, orderInTv) => {
    const orderInCharacter = characterOrderCounters.get(edge.characterIdentityKey) ?? 0
    characterOrderCounters.set(edge.characterIdentityKey, orderInCharacter + 1)

    return {
      tvIdentityKey,
      characterIdentityKey: edge.characterIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInTv,
      orderInCharacter
    }
  })
}

function finalizeCharacterPersonLinks(
  edgeMap: Map<string, PendingCharacterPersonLink>
): IngestCharacterPersonLink[] {
  const characterOrderCounters = new Map<string, number>()
  const personOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge) => {
    const orderInCharacter = characterOrderCounters.get(edge.characterIdentityKey) ?? 0
    characterOrderCounters.set(edge.characterIdentityKey, orderInCharacter + 1)

    const orderInPerson = personOrderCounters.get(edge.personIdentityKey) ?? 0
    personOrderCounters.set(edge.personIdentityKey, orderInPerson + 1)

    return {
      characterIdentityKey: edge.characterIdentityKey,
      personIdentityKey: edge.personIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInCharacter,
      orderInPerson
    }
  })
}

function toTvRootCore(bundle: ScrapedTvBundle | null, lookup: ScraperLookup): CoreTvMetadata {
  const normalized = normalizeTvCore({
    ...(bundle?.core ?? {}),
    name: firstNonEmpty(bundle?.core?.name, lookup.name),
    externalIds: mergeExternalIds(bundle?.identity.externalIds, lookup.knownIds)
  })

  if (!normalized) {
    throw new Error('Ingest requires a non-empty tv name')
  }

  return normalized
}

function normalizeTvPersonFactCore(fact: ScrapedTvPersonFact): CorePersonMetadata | null {
  return normalizePersonCore({
    ...fact,
    externalIds: fact.identity.externalIds
  })
}

function normalizeTvCompanyFactCore(fact: ScrapedTvCompanyFact): CoreCompanyMetadata | null {
  return normalizeCompanyCore({
    ...fact,
    externalIds: fact.identity.externalIds
  })
}

function normalizeTvCharacterFactCore(fact: ScrapedTvCharacterFact): CoreCharacterMetadata | null {
  return normalizeCharacterCore({
    ...fact,
    externalIds: fact.identity.externalIds
  })
}

function normalizeCharacterPersonFactCore(
  fact: ScrapedCharacterPersonFact
): CorePersonMetadata | null {
  return normalizePersonCore({
    ...fact,
    externalIds: fact.identity.externalIds
  })
}

/**
 * Normalize scraped seasons into ingest order.
 *
 * Season 0 holds specials and sorts first, matching how the detail view groups
 * them. Shared with the update flow, which realigns stored rows against this
 * list by season number.
 */
export function normalizeTvSeasons(
  seasons: TvSeasonInfo[] | undefined
): TvSeasonInfo[] | undefined {
  if (!seasons) return undefined

  const byNumber = new Map<number, TvSeasonInfo>()
  for (const season of seasons) {
    if (!Number.isInteger(season.number) || season.number < 0) continue

    byNumber.set(season.number, {
      number: season.number,
      name: normalizeOptionalString(season.name),
      originalName: normalizeOptionalString(season.originalName),
      airDate: season.airDate,
      description: normalizeOptionalString(season.description),
      totalEpisodes: season.totalEpisodes
    })
  }

  return [...byNumber.values()].sort((a, b) => a.number - b.number)
}

/**
 * Normalize scraped episodes into ingest order.
 *
 * Episodes are keyed by (season, number) — the pair a source revises least —
 * while their external ids ride along so a re-scrape can realign stored rows
 * even when the numbering changed.
 */
export function normalizeTvEpisodes(
  episodes: TvEpisodeInfo[] | undefined
): TvEpisodeInfo[] | undefined {
  if (!episodes) return undefined

  const byKey = new Map<string, TvEpisodeInfo>()
  for (const episode of episodes) {
    if (!Number.isFinite(episode.number)) continue
    if (!Number.isInteger(episode.seasonNumber) || episode.seasonNumber < 0) continue

    const normalized: TvEpisodeInfo = {
      seasonNumber: episode.seasonNumber,
      number: episode.number,
      name: normalizeOptionalString(episode.name),
      originalName: normalizeOptionalString(episode.originalName),
      airDate: episode.airDate,
      description: normalizeOptionalString(episode.description),
      durationMs: episode.durationMs,
      externalIds: mergeExternalIds(undefined, episode.externalIds)
    }
    byKey.set(`${normalized.seasonNumber}:${normalized.number}`, normalized)
  }

  return [...byKey.values()].sort((a, b) => a.seasonNumber - b.seasonNumber || a.number - b.number)
}

/**
 * Seasons a scrape did not state but its episodes imply.
 *
 * A source may list episodes without a season index; every episode still needs
 * a season row to hang from, so the missing numbers become bare seasons.
 */
function withImpliedSeasons(
  seasons: TvSeasonInfo[] | undefined,
  episodes: TvEpisodeInfo[] | undefined
): TvSeasonInfo[] | undefined {
  if (!episodes) return seasons

  const merged = [...(seasons ?? [])]
  const stated = new Set(merged.map((season) => season.number))
  for (const episode of episodes) {
    if (stated.has(episode.seasonNumber)) continue
    stated.add(episode.seasonNumber)
    merged.push({ number: episode.seasonNumber })
  }

  return merged.sort((a, b) => a.number - b.number)
}

function buildTvGraphInternal(
  bundle: ScrapedTvBundle | null,
  lookup: ScraperLookup
): IngestTvGraph {
  const tvCore = toTvRootCore(bundle, lookup)
  const tvIdentityKey = buildEntityCanonicalIdentityKey(tvCore)

  const personNodes = new Map<string, IngestPersonNode>()
  const companyNodes = new Map<string, IngestCompanyNode>()
  const characterNodes = new Map<string, IngestCharacterNode>()
  const personIdentityIndex = createIdentityAliasIndex()
  const companyIdentityIndex = createIdentityAliasIndex()
  const characterIdentityIndex = createIdentityAliasIndex()
  const tvPersonLinks = new Map<string, PendingTvPersonLink>()
  const tvCompanyLinks = new Map<string, PendingTvCompanyLink>()
  const tvCharacterLinks = new Map<string, PendingTvCharacterLink>()
  const characterPersonLinks = new Map<string, PendingCharacterPersonLink>()

  for (const fact of bundle?.relationFacts?.tvPerson ?? []) {
    const core = normalizeTvPersonFactCore(fact)
    if (!core) continue

    const personIdentityKey = upsertPersonNode(personNodes, personIdentityIndex, core, fact.photos)
    upsertTvPersonLink(
      tvPersonLinks,
      personIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )
  }

  for (const fact of bundle?.relationFacts?.tvCompany ?? []) {
    const core = normalizeTvCompanyFactCore(fact)
    if (!core) continue

    const companyIdentityKey = upsertCompanyNode(
      companyNodes,
      companyIdentityIndex,
      core,
      fact.logos
    )
    upsertTvCompanyLink(
      tvCompanyLinks,
      companyIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )
  }

  for (const fact of bundle?.relationFacts?.tvCharacter ?? []) {
    const core = normalizeTvCharacterFactCore(fact)
    if (!core) continue

    const characterIdentityKey = upsertCharacterNode(
      characterNodes,
      characterIdentityIndex,
      core,
      fact.photos
    )
    upsertTvCharacterLink(
      tvCharacterLinks,
      characterIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )

    // Cast credits bind to the character and to the show: the character link
    // says who plays whom, the tv link says which entry that casting is for.
    for (const personFact of fact.persons ?? []) {
      const personCore = normalizeCharacterPersonFactCore(personFact)
      if (!personCore) continue

      const personIdentityKey = upsertPersonNode(
        personNodes,
        personIdentityIndex,
        personCore,
        personFact.photos
      )
      const note = normalizeOptionalString(personFact.note)
      upsertCharacterPersonLink(
        characterPersonLinks,
        characterIdentityKey,
        personIdentityKey,
        personFact.role,
        personFact.isSpoiler,
        note
      )
      upsertTvPersonLink(
        tvPersonLinks,
        personIdentityKey,
        toTvPersonRoleFromCharacterPerson(personFact.role),
        personFact.isSpoiler,
        note
      )
    }
  }

  for (const fact of bundle?.relationFacts?.characterPerson ?? []) {
    const personCore = normalizeCharacterPersonFactCore(fact)
    if (!personCore) continue

    const personIdentityKey = upsertPersonNode(
      personNodes,
      personIdentityIndex,
      personCore,
      fact.photos
    )

    const characterCore = fact.character
      ? normalizeCharacterCore({
          ...fact.character,
          externalIds: fact.character.identity.externalIds
        })
      : null
    if (!characterCore) continue

    const characterIdentityKey = upsertCharacterNode(
      characterNodes,
      characterIdentityIndex,
      characterCore,
      undefined
    )
    const note = normalizeOptionalString(fact.note)
    upsertCharacterPersonLink(
      characterPersonLinks,
      characterIdentityKey,
      personIdentityKey,
      fact.role,
      fact.isSpoiler,
      note
    )
    upsertTvPersonLink(
      tvPersonLinks,
      personIdentityKey,
      toTvPersonRoleFromCharacterPerson(fact.role),
      fact.isSpoiler,
      note
    )
  }

  const media = bundle?.mediaCandidates
  const episodes = normalizeTvEpisodes(bundle?.episodes)

  return {
    tv: {
      identityKey: tvIdentityKey,
      core: tvCore
    },
    seasons: withImpliedSeasons(normalizeTvSeasons(bundle?.seasons), episodes),
    episodes,
    persons: [...personNodes.values()].sort((a, b) => compareText(a.identityKey, b.identityKey)),
    companies: [...companyNodes.values()].sort((a, b) => compareText(a.identityKey, b.identityKey)),
    characters: [...characterNodes.values()].sort((a, b) =>
      compareText(a.identityKey, b.identityKey)
    ),
    links: {
      tvPerson: finalizeTvPersonLinks(tvIdentityKey, tvPersonLinks),
      tvCompany: finalizeTvCompanyLinks(tvIdentityKey, tvCompanyLinks),
      tvCharacter: finalizeTvCharacterLinks(tvIdentityKey, tvCharacterLinks),
      characterPerson: finalizeCharacterPersonLinks(characterPersonLinks)
    },
    relatedEntries: bundle?.relationFacts?.relatedEntries,
    media: {
      coverUrl: pickFirstUrl(media?.coverUrls),
      backdropUrl: pickFirstUrl(media?.backdropUrls),
      logoUrl: pickFirstUrl(media?.logoUrls)
    }
  }
}

export function buildTvGraph(bundle: ScrapedTvBundle, lookup: ScraperLookup): IngestTvGraph {
  return buildTvGraphInternal(bundle, lookup)
}

export function buildDirectTvGraph(lookup: ScraperLookup): IngestTvGraph {
  return buildTvGraphInternal(null, lookup)
}
