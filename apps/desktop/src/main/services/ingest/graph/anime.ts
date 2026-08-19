import type {
  AnimeCharacterRole,
  AnimeCompanyRole,
  AnimePersonRole,
  CharacterPersonRole
} from '@shared/db'
import { buildEntityCanonicalIdentityKey } from '@shared/identity'
import type {
  AnimeEpisodeInfo,
  CoreAnimeMetadata,
  CoreCharacterMetadata,
  CoreCompanyMetadata,
  CorePersonMetadata
} from '@shared/metadata'
import type {
  IngestAnimeCharacterLink,
  IngestAnimeCompanyLink,
  IngestAnimeGraph,
  IngestAnimePersonLink,
  IngestCharacterNode,
  IngestCharacterPersonLink,
  IngestCompanyNode,
  IngestPersonNode
} from './types'
import type {
  ScrapedAnimeBundle,
  ScrapedAnimeCharacterFact,
  ScrapedAnimeCompanyFact,
  ScrapedAnimePersonFact,
  ScrapedCharacterPersonFact,
  ScraperLookup
} from '@shared/scraper'
import {
  absorbPlaying,
  compareText,
  createIdentityAliasIndex,
  createPendingPlaying,
  finalizePlaying,
  firstNonEmpty,
  mergeExternalIds,
  normalizeAnimeCore,
  normalizeCharacterCore,
  normalizeCompanyCore,
  normalizeOptionalString,
  normalizePersonCore,
  pickFirstUrl,
  upsertCharacterNode,
  upsertCompanyNode,
  upsertPersonNode,
  type PendingPlaying,
  type PlayingInput
} from './common'

interface PendingAnimePersonLink {
  personIdentityKey: string
  role: AnimePersonRole
  isSpoiler: boolean
  playing: PendingPlaying
  note?: string
}

interface PendingAnimeCompanyLink {
  companyIdentityKey: string
  role: AnimeCompanyRole
  isSpoiler: boolean
  note?: string
}

interface PendingAnimeCharacterLink {
  characterIdentityKey: string
  role: AnimeCharacterRole
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
 * Coarsen a cast credit into the anime staff vocabulary.
 *
 * Character-person roles name what someone did for a character; the anime side
 * has one role for design work regardless of which of the two it was.
 */
function toAnimePersonRoleFromCharacterPerson(role: CharacterPersonRole): AnimePersonRole {
  switch (role) {
    case 'actor':
      return 'actor'
    case 'illustration':
    case 'designer':
      return 'characterDesign'
    case 'other':
      return 'other'
  }
}

function upsertAnimePersonLink(
  edgeMap: Map<string, PendingAnimePersonLink>,
  personIdentityKey: string,
  role: AnimePersonRole,
  isSpoiler: boolean | undefined,
  playing: PlayingInput,
  note: string | undefined
): void {
  const key = `${personIdentityKey}:${role}`
  const existing = edgeMap.get(key)
  if (!existing) {
    const pendingPlaying = createPendingPlaying()
    absorbPlaying(pendingPlaying, playing)
    edgeMap.set(key, {
      personIdentityKey,
      role,
      isSpoiler: !!isSpoiler,
      playing: pendingPlaying,
      note: normalizeOptionalString(note)
    })
    return
  }

  existing.isSpoiler = existing.isSpoiler || !!isSpoiler
  absorbPlaying(existing.playing, playing)
  existing.note = firstNonEmpty(existing.note, note)
}

function upsertAnimeCompanyLink(
  edgeMap: Map<string, PendingAnimeCompanyLink>,
  companyIdentityKey: string,
  role: AnimeCompanyRole,
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

function upsertAnimeCharacterLink(
  edgeMap: Map<string, PendingAnimeCharacterLink>,
  characterIdentityKey: string,
  role: AnimeCharacterRole,
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

function finalizeAnimePersonLinks(
  animeIdentityKey: string,
  edgeMap: Map<string, PendingAnimePersonLink>
): IngestAnimePersonLink[] {
  // Map iteration keeps the merged relation order from scraper results.
  const personOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge, orderInAnime) => {
    const orderInPerson = personOrderCounters.get(edge.personIdentityKey) ?? 0
    personOrderCounters.set(edge.personIdentityKey, orderInPerson + 1)

    return {
      animeIdentityKey,
      personIdentityKey: edge.personIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      playing: finalizePlaying(edge.playing),
      note: edge.note,
      orderInAnime,
      orderInPerson
    }
  })
}

function finalizeAnimeCompanyLinks(
  animeIdentityKey: string,
  edgeMap: Map<string, PendingAnimeCompanyLink>
): IngestAnimeCompanyLink[] {
  const companyOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge, orderInAnime) => {
    const orderInCompany = companyOrderCounters.get(edge.companyIdentityKey) ?? 0
    companyOrderCounters.set(edge.companyIdentityKey, orderInCompany + 1)

    return {
      animeIdentityKey,
      companyIdentityKey: edge.companyIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInAnime,
      orderInCompany
    }
  })
}

function finalizeAnimeCharacterLinks(
  animeIdentityKey: string,
  edgeMap: Map<string, PendingAnimeCharacterLink>
): IngestAnimeCharacterLink[] {
  const characterOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge, orderInAnime) => {
    const orderInCharacter = characterOrderCounters.get(edge.characterIdentityKey) ?? 0
    characterOrderCounters.set(edge.characterIdentityKey, orderInCharacter + 1)

    return {
      animeIdentityKey,
      characterIdentityKey: edge.characterIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInAnime,
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

function toAnimeRootCore(
  bundle: ScrapedAnimeBundle | null,
  lookup: ScraperLookup
): CoreAnimeMetadata {
  const normalized = normalizeAnimeCore({
    ...(bundle?.core ?? {}),
    name: firstNonEmpty(bundle?.core?.name, lookup.name),
    externalIds: mergeExternalIds(bundle?.identity.externalIds, lookup.knownIds)
  })

  if (!normalized) {
    throw new Error('Ingest requires a non-empty anime name')
  }

  return normalized
}

function normalizeAnimePersonFactCore(fact: ScrapedAnimePersonFact): CorePersonMetadata | null {
  return normalizePersonCore({
    ...fact,
    externalIds: fact.identity.externalIds
  })
}

function normalizeAnimeCompanyFactCore(fact: ScrapedAnimeCompanyFact): CoreCompanyMetadata | null {
  return normalizeCompanyCore({
    ...fact,
    externalIds: fact.identity.externalIds
  })
}

function normalizeAnimeCharacterFactCore(
  fact: ScrapedAnimeCharacterFact
): CoreCharacterMetadata | null {
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
 * Normalize scraped episodes into ingest order.
 *
 * Sources revise episode numbering, so the stated number stays authoritative
 * while type keeps regular and special runs in separate sequences. Shared with
 * the update flow, which realigns stored rows against this list.
 */
export function normalizeAnimeEpisodes(
  episodes: AnimeEpisodeInfo[] | undefined
): AnimeEpisodeInfo[] | undefined {
  if (!episodes) return undefined

  const byKey = new Map<string, AnimeEpisodeInfo>()
  for (const episode of episodes) {
    if (!Number.isFinite(episode.number)) continue

    const normalized: AnimeEpisodeInfo = {
      number: episode.number,
      type: episode.type,
      name: normalizeOptionalString(episode.name),
      originalName: normalizeOptionalString(episode.originalName),
      airDate: episode.airDate,
      description: normalizeOptionalString(episode.description),
      durationMs: episode.durationMs,
      externalIds: mergeExternalIds(undefined, episode.externalIds)
    }
    byKey.set(`${normalized.type}:${normalized.number}`, normalized)
  }

  return [...byKey.values()].sort((a, b) => a.type.localeCompare(b.type) || a.number - b.number)
}

function buildAnimeGraphInternal(
  bundle: ScrapedAnimeBundle | null,
  lookup: ScraperLookup
): IngestAnimeGraph {
  const animeCore = toAnimeRootCore(bundle, lookup)
  const animeIdentityKey = buildEntityCanonicalIdentityKey(animeCore)

  const personNodes = new Map<string, IngestPersonNode>()
  const companyNodes = new Map<string, IngestCompanyNode>()
  const characterNodes = new Map<string, IngestCharacterNode>()
  const personIdentityIndex = createIdentityAliasIndex()
  const companyIdentityIndex = createIdentityAliasIndex()
  const characterIdentityIndex = createIdentityAliasIndex()
  const animePersonLinks = new Map<string, PendingAnimePersonLink>()
  const animeCompanyLinks = new Map<string, PendingAnimeCompanyLink>()
  const animeCharacterLinks = new Map<string, PendingAnimeCharacterLink>()
  const characterPersonLinks = new Map<string, PendingCharacterPersonLink>()

  for (const fact of bundle?.relationFacts?.animePerson ?? []) {
    const core = normalizeAnimePersonFactCore(fact)
    if (!core) continue

    const personIdentityKey = upsertPersonNode(personNodes, personIdentityIndex, core, fact.photos)
    upsertAnimePersonLink(
      animePersonLinks,
      personIdentityKey,
      fact.role,
      fact.isSpoiler,
      { stated: fact.playing },
      normalizeOptionalString(fact.note)
    )
  }

  for (const fact of bundle?.relationFacts?.animeCompany ?? []) {
    const core = normalizeAnimeCompanyFactCore(fact)
    if (!core) continue

    const companyIdentityKey = upsertCompanyNode(
      companyNodes,
      companyIdentityIndex,
      core,
      fact.logos
    )
    upsertAnimeCompanyLink(
      animeCompanyLinks,
      companyIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )
  }

  for (const fact of bundle?.relationFacts?.animeCharacter ?? []) {
    const core = normalizeAnimeCharacterFactCore(fact)
    if (!core) continue

    const characterIdentityKey = upsertCharacterNode(
      characterNodes,
      characterIdentityIndex,
      core,
      fact.photos
    )
    upsertAnimeCharacterLink(
      animeCharacterLinks,
      characterIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )

    // Cast credits bind to the character and to the anime: the character link
    // says who plays whom, the anime link says which entry that casting is for
    // and carries the credited character name so the pairing survives the split.
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
      upsertAnimePersonLink(
        animePersonLinks,
        personIdentityKey,
        toAnimePersonRoleFromCharacterPerson(personFact.role),
        personFact.isSpoiler,
        { derived: core.name },
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
    upsertAnimePersonLink(
      animePersonLinks,
      personIdentityKey,
      toAnimePersonRoleFromCharacterPerson(fact.role),
      fact.isSpoiler,
      { derived: characterCore.name },
      note
    )
  }

  const media = bundle?.mediaCandidates

  return {
    anime: {
      identityKey: animeIdentityKey,
      core: animeCore
    },
    episodes: normalizeAnimeEpisodes(bundle?.episodes),
    persons: [...personNodes.values()].sort((a, b) => compareText(a.identityKey, b.identityKey)),
    companies: [...companyNodes.values()].sort((a, b) => compareText(a.identityKey, b.identityKey)),
    characters: [...characterNodes.values()].sort((a, b) =>
      compareText(a.identityKey, b.identityKey)
    ),
    links: {
      animePerson: finalizeAnimePersonLinks(animeIdentityKey, animePersonLinks),
      animeCompany: finalizeAnimeCompanyLinks(animeIdentityKey, animeCompanyLinks),
      animeCharacter: finalizeAnimeCharacterLinks(animeIdentityKey, animeCharacterLinks),
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

export function buildAnimeGraph(
  bundle: ScrapedAnimeBundle,
  lookup: ScraperLookup
): IngestAnimeGraph {
  return buildAnimeGraphInternal(bundle, lookup)
}

export function buildDirectAnimeGraph(lookup: ScraperLookup): IngestAnimeGraph {
  return buildAnimeGraphInternal(null, lookup)
}
