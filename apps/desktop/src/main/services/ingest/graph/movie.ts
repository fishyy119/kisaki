import type {
  CharacterPersonRole,
  MovieCharacterRole,
  MovieCompanyRole,
  MoviePersonRole
} from '@shared/db'
import { buildEntityCanonicalIdentityKey } from '@shared/identity'
import type {
  CoreCharacterMetadata,
  CoreCompanyMetadata,
  CoreMovieMetadata,
  CorePersonMetadata
} from '@shared/metadata'
import type {
  IngestCharacterNode,
  IngestCharacterPersonLink,
  IngestCompanyNode,
  IngestMovieCharacterLink,
  IngestMovieCompanyLink,
  IngestMovieGraph,
  IngestMoviePersonLink,
  IngestPersonNode
} from './types'
import type {
  ScrapedCharacterPersonFact,
  ScrapedMovieBundle,
  ScrapedMovieCharacterFact,
  ScrapedMovieCompanyFact,
  ScrapedMoviePersonFact,
  ScraperLookup
} from '@shared/scraper'
import {
  compareText,
  createIdentityAliasIndex,
  firstNonEmpty,
  mergeExternalIds,
  normalizeCharacterCore,
  normalizeCompanyCore,
  normalizeMovieCore,
  normalizeOptionalString,
  normalizePersonCore,
  pickFirstUrl,
  upsertCharacterNode,
  upsertCompanyNode,
  upsertPersonNode
} from './common'

interface PendingMoviePersonLink {
  personIdentityKey: string
  role: MoviePersonRole
  isSpoiler: boolean
  note?: string
}

interface PendingMovieCompanyLink {
  companyIdentityKey: string
  role: MovieCompanyRole
  isSpoiler: boolean
  note?: string
}

interface PendingMovieCharacterLink {
  characterIdentityKey: string
  role: MovieCharacterRole
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
 * Coarsen a cast credit into the movie crew vocabulary.
 *
 * Live-action credit lists have no design roles, so only performance carries a
 * matching crew role; the rest land in `other`.
 */
function toMoviePersonRoleFromCharacterPerson(role: CharacterPersonRole): MoviePersonRole {
  switch (role) {
    case 'actor':
      return 'actor'
    case 'illustration':
    case 'designer':
    case 'other':
      return 'other'
  }
}

function upsertMoviePersonLink(
  edgeMap: Map<string, PendingMoviePersonLink>,
  personIdentityKey: string,
  role: MoviePersonRole,
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

function upsertMovieCompanyLink(
  edgeMap: Map<string, PendingMovieCompanyLink>,
  companyIdentityKey: string,
  role: MovieCompanyRole,
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

function upsertMovieCharacterLink(
  edgeMap: Map<string, PendingMovieCharacterLink>,
  characterIdentityKey: string,
  role: MovieCharacterRole,
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

function finalizeMoviePersonLinks(
  movieIdentityKey: string,
  edgeMap: Map<string, PendingMoviePersonLink>
): IngestMoviePersonLink[] {
  // Map iteration keeps the merged relation order from scraper results.
  const personOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge, orderInMovie) => {
    const orderInPerson = personOrderCounters.get(edge.personIdentityKey) ?? 0
    personOrderCounters.set(edge.personIdentityKey, orderInPerson + 1)

    return {
      movieIdentityKey,
      personIdentityKey: edge.personIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInMovie,
      orderInPerson
    }
  })
}

function finalizeMovieCompanyLinks(
  movieIdentityKey: string,
  edgeMap: Map<string, PendingMovieCompanyLink>
): IngestMovieCompanyLink[] {
  const companyOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge, orderInMovie) => {
    const orderInCompany = companyOrderCounters.get(edge.companyIdentityKey) ?? 0
    companyOrderCounters.set(edge.companyIdentityKey, orderInCompany + 1)

    return {
      movieIdentityKey,
      companyIdentityKey: edge.companyIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInMovie,
      orderInCompany
    }
  })
}

function finalizeMovieCharacterLinks(
  movieIdentityKey: string,
  edgeMap: Map<string, PendingMovieCharacterLink>
): IngestMovieCharacterLink[] {
  const characterOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge, orderInMovie) => {
    const orderInCharacter = characterOrderCounters.get(edge.characterIdentityKey) ?? 0
    characterOrderCounters.set(edge.characterIdentityKey, orderInCharacter + 1)

    return {
      movieIdentityKey,
      characterIdentityKey: edge.characterIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInMovie,
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

function toMovieRootCore(
  bundle: ScrapedMovieBundle | null,
  lookup: ScraperLookup
): CoreMovieMetadata {
  const normalized = normalizeMovieCore({
    ...(bundle?.core ?? {}),
    name: firstNonEmpty(bundle?.core?.name, lookup.name),
    externalIds: mergeExternalIds(bundle?.identity.externalIds, lookup.knownIds)
  })

  if (!normalized) {
    throw new Error('Ingest requires a non-empty movie name')
  }

  return normalized
}

function normalizeMoviePersonFactCore(fact: ScrapedMoviePersonFact): CorePersonMetadata | null {
  return normalizePersonCore({
    ...fact,
    externalIds: fact.identity.externalIds
  })
}

function normalizeMovieCompanyFactCore(fact: ScrapedMovieCompanyFact): CoreCompanyMetadata | null {
  return normalizeCompanyCore({
    ...fact,
    externalIds: fact.identity.externalIds
  })
}

function normalizeMovieCharacterFactCore(
  fact: ScrapedMovieCharacterFact
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

function buildMovieGraphInternal(
  bundle: ScrapedMovieBundle | null,
  lookup: ScraperLookup
): IngestMovieGraph {
  const movieCore = toMovieRootCore(bundle, lookup)
  const movieIdentityKey = buildEntityCanonicalIdentityKey(movieCore)

  const personNodes = new Map<string, IngestPersonNode>()
  const companyNodes = new Map<string, IngestCompanyNode>()
  const characterNodes = new Map<string, IngestCharacterNode>()
  const personIdentityIndex = createIdentityAliasIndex()
  const companyIdentityIndex = createIdentityAliasIndex()
  const characterIdentityIndex = createIdentityAliasIndex()
  const moviePersonLinks = new Map<string, PendingMoviePersonLink>()
  const movieCompanyLinks = new Map<string, PendingMovieCompanyLink>()
  const movieCharacterLinks = new Map<string, PendingMovieCharacterLink>()
  const characterPersonLinks = new Map<string, PendingCharacterPersonLink>()

  for (const fact of bundle?.relationFacts?.moviePerson ?? []) {
    const core = normalizeMoviePersonFactCore(fact)
    if (!core) continue

    const personIdentityKey = upsertPersonNode(personNodes, personIdentityIndex, core, fact.photos)
    upsertMoviePersonLink(
      moviePersonLinks,
      personIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )
  }

  for (const fact of bundle?.relationFacts?.movieCompany ?? []) {
    const core = normalizeMovieCompanyFactCore(fact)
    if (!core) continue

    const companyIdentityKey = upsertCompanyNode(
      companyNodes,
      companyIdentityIndex,
      core,
      fact.logos
    )
    upsertMovieCompanyLink(
      movieCompanyLinks,
      companyIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )
  }

  for (const fact of bundle?.relationFacts?.movieCharacter ?? []) {
    const core = normalizeMovieCharacterFactCore(fact)
    if (!core) continue

    const characterIdentityKey = upsertCharacterNode(
      characterNodes,
      characterIdentityIndex,
      core,
      fact.photos
    )
    upsertMovieCharacterLink(
      movieCharacterLinks,
      characterIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )

    // Cast credits bind to the character and to the film: the character link
    // says who plays whom, the movie link says which entry that casting is for.
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
      upsertMoviePersonLink(
        moviePersonLinks,
        personIdentityKey,
        toMoviePersonRoleFromCharacterPerson(personFact.role),
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
    upsertMoviePersonLink(
      moviePersonLinks,
      personIdentityKey,
      toMoviePersonRoleFromCharacterPerson(fact.role),
      fact.isSpoiler,
      note
    )
  }

  const media = bundle?.mediaCandidates

  return {
    movie: {
      identityKey: movieIdentityKey,
      core: movieCore
    },
    persons: [...personNodes.values()].sort((a, b) => compareText(a.identityKey, b.identityKey)),
    companies: [...companyNodes.values()].sort((a, b) => compareText(a.identityKey, b.identityKey)),
    characters: [...characterNodes.values()].sort((a, b) =>
      compareText(a.identityKey, b.identityKey)
    ),
    links: {
      moviePerson: finalizeMoviePersonLinks(movieIdentityKey, moviePersonLinks),
      movieCompany: finalizeMovieCompanyLinks(movieIdentityKey, movieCompanyLinks),
      movieCharacter: finalizeMovieCharacterLinks(movieIdentityKey, movieCharacterLinks),
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

export function buildMovieGraph(
  bundle: ScrapedMovieBundle,
  lookup: ScraperLookup
): IngestMovieGraph {
  return buildMovieGraphInternal(bundle, lookup)
}

export function buildDirectMovieGraph(lookup: ScraperLookup): IngestMovieGraph {
  return buildMovieGraphInternal(null, lookup)
}
