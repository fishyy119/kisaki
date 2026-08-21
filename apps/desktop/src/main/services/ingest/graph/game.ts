import type {
  CharacterPersonRole,
  GameCharacterRole,
  GameCompanyRole,
  GamePersonRole
} from '@shared/db'
import { buildEntityCanonicalIdentityKey } from '@shared/identity'
import type {
  CoreCharacterMetadata,
  CoreCompanyMetadata,
  CoreGameMetadata,
  CorePersonMetadata
} from '@shared/metadata'
import type {
  IngestGameGraph,
  IngestGameCastLink,
  IngestGameCharacterLink,
  IngestCharacterPersonLink,
  IngestGameCompanyLink,
  IngestGamePersonLink,
  IngestCharacterNode,
  IngestCompanyNode,
  IngestPersonNode
} from './types'
import type {
  ScrapedCharacterPersonFact,
  ScrapedGameBundle,
  ScrapedGameCharacterFact,
  ScrapedGameCompanyFact,
  ScrapedGamePersonFact,
  ScraperLookup
} from '@shared/scraper'
import {
  compareText,
  createIdentityAliasIndex,
  firstNonEmpty,
  mergeExternalIds,
  normalizeCharacterCore,
  normalizeCompanyCore,
  normalizeGameCore,
  normalizeOptionalString,
  normalizePersonCore,
  pickFirstUrl,
  upsertCharacterNode,
  upsertCompanyNode,
  upsertPersonNode
} from './common'

interface PendingGamePersonLink {
  personIdentityKey: string
  role: GamePersonRole
  isSpoiler: boolean
  note?: string
}

interface PendingGameCastLink {
  characterIdentityKey: string
  personIdentityKey: string
  note?: string
}

interface PendingGameCompanyLink {
  companyIdentityKey: string
  role: GameCompanyRole
  isSpoiler: boolean
  note?: string
}

interface PendingGameCharacterLink {
  characterIdentityKey: string
  role: GameCharacterRole
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

function toGamePersonRoleFromCharacterPerson(role: CharacterPersonRole): GamePersonRole {
  switch (role) {
    case 'actor':
      return 'actor'
    case 'illustration':
      return 'illustration'
    case 'designer':
    case 'other':
      return 'other'
  }
}

function upsertGamePersonLink(
  edgeMap: Map<string, PendingGamePersonLink>,
  personIdentityKey: string,
  role: GamePersonRole,
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

function upsertGameCastLink(
  edgeMap: Map<string, PendingGameCastLink>,
  characterIdentityKey: string,
  personIdentityKey: string,
  note: string | undefined
): void {
  const key = `${characterIdentityKey}:${personIdentityKey}`
  const existing = edgeMap.get(key)
  if (!existing) {
    edgeMap.set(key, {
      characterIdentityKey,
      personIdentityKey,
      note: normalizeOptionalString(note)
    })
    return
  }

  existing.note = firstNonEmpty(existing.note, note)
}

function upsertGameCompanyLink(
  edgeMap: Map<string, PendingGameCompanyLink>,
  companyIdentityKey: string,
  role: GameCompanyRole,
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

function upsertGameCharacterLink(
  edgeMap: Map<string, PendingGameCharacterLink>,
  characterIdentityKey: string,
  role: GameCharacterRole,
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
  role: CharacterPersonRole,
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

function finalizeGamePersonLinks(
  gameIdentityKey: string,
  edgeMap: Map<string, PendingGamePersonLink>
): IngestGamePersonLink[] {
  // Preserve the merged relation order from scraper results.
  // Map iteration keeps first-insertion order, which matches the first appearance
  // order established by provider priority + provider payload order during merge.
  const ordered = [...edgeMap.values()]

  const personOrderCounters = new Map<string, number>()

  return ordered.map((edge, orderInGame) => {
    const orderInPerson = personOrderCounters.get(edge.personIdentityKey) ?? 0
    personOrderCounters.set(edge.personIdentityKey, orderInPerson + 1)

    return {
      gameIdentityKey,
      personIdentityKey: edge.personIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInGame,
      orderInPerson
    }
  })
}

function finalizeGameCastLinks(
  gameIdentityKey: string,
  edgeMap: Map<string, PendingGameCastLink>
): IngestGameCastLink[] {
  return [...edgeMap.values()].map((edge) => ({
    gameIdentityKey,
    characterIdentityKey: edge.characterIdentityKey,
    personIdentityKey: edge.personIdentityKey,
    note: edge.note
  }))
}

function finalizeGameCompanyLinks(
  gameIdentityKey: string,
  edgeMap: Map<string, PendingGameCompanyLink>
): IngestGameCompanyLink[] {
  // Preserve the merged relation order from scraper results.
  const ordered = [...edgeMap.values()]

  const companyOrderCounters = new Map<string, number>()

  return ordered.map((edge, orderInGame) => {
    const orderInCompany = companyOrderCounters.get(edge.companyIdentityKey) ?? 0
    companyOrderCounters.set(edge.companyIdentityKey, orderInCompany + 1)

    return {
      gameIdentityKey,
      companyIdentityKey: edge.companyIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInGame,
      orderInCompany
    }
  })
}

function finalizeGameCharacterLinks(
  gameIdentityKey: string,
  edgeMap: Map<string, PendingGameCharacterLink>
): IngestGameCharacterLink[] {
  // Preserve the merged relation order from scraper results.
  const ordered = [...edgeMap.values()]

  const characterOrderCounters = new Map<string, number>()

  return ordered.map((edge, orderInGame) => {
    const orderInCharacter = characterOrderCounters.get(edge.characterIdentityKey) ?? 0
    characterOrderCounters.set(edge.characterIdentityKey, orderInCharacter + 1)

    return {
      gameIdentityKey,
      characterIdentityKey: edge.characterIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInGame,
      orderInCharacter
    }
  })
}

function finalizeCharacterPersonLinks(
  edgeMap: Map<string, PendingCharacterPersonLink>
): IngestCharacterPersonLink[] {
  // Preserve the merged relation order from scraper results.
  const ordered = [...edgeMap.values()]

  const characterOrderCounters = new Map<string, number>()
  const personOrderCounters = new Map<string, number>()

  return ordered.map((edge) => {
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

function toGameRootCore(bundle: ScrapedGameBundle | null, lookup: ScraperLookup): CoreGameMetadata {
  const normalized = normalizeGameCore({
    ...(bundle?.core ?? {}),
    name: firstNonEmpty(bundle?.core?.name, lookup.name),
    externalIds: mergeExternalIds(bundle?.identity.externalIds, lookup.knownIds)
  })

  if (!normalized) {
    throw new Error('Ingest requires a non-empty game name')
  }

  return normalized
}

function normalizeGamePersonFactCore(fact: ScrapedGamePersonFact): CorePersonMetadata | null {
  return normalizePersonCore({
    ...fact,
    externalIds: fact.identity.externalIds
  })
}

function normalizeGameCompanyFactCore(fact: ScrapedGameCompanyFact): CoreCompanyMetadata | null {
  return normalizeCompanyCore({
    ...fact,
    externalIds: fact.identity.externalIds
  })
}

function normalizeGameCharacterFactCore(
  fact: ScrapedGameCharacterFact
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

function buildGameGraphInternal(
  bundle: ScrapedGameBundle | null,
  lookup: ScraperLookup
): IngestGameGraph {
  const gameCore = toGameRootCore(bundle, lookup)
  const gameIdentityKey = buildEntityCanonicalIdentityKey(gameCore)

  const personNodes = new Map<string, IngestPersonNode>()
  const companyNodes = new Map<string, IngestCompanyNode>()
  const characterNodes = new Map<string, IngestCharacterNode>()
  const personIdentityIndex = createIdentityAliasIndex()
  const companyIdentityIndex = createIdentityAliasIndex()
  const characterIdentityIndex = createIdentityAliasIndex()
  const gamePersonLinks = new Map<string, PendingGamePersonLink>()
  const gameCompanyLinks = new Map<string, PendingGameCompanyLink>()
  const gameCharacterLinks = new Map<string, PendingGameCharacterLink>()
  const gameCastLinks = new Map<string, PendingGameCastLink>()
  const characterPersonLinks = new Map<string, PendingCharacterPersonLink>()

  for (const fact of bundle?.relationFacts?.gamePerson ?? []) {
    const core = normalizeGamePersonFactCore(fact)
    if (!core) continue

    const personIdentityKey = upsertPersonNode(personNodes, personIdentityIndex, core, fact.photos)
    upsertGamePersonLink(
      gamePersonLinks,
      personIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )
  }

  for (const fact of bundle?.relationFacts?.gameCompany ?? []) {
    const core = normalizeGameCompanyFactCore(fact)
    if (!core) continue

    const companyIdentityKey = upsertCompanyNode(
      companyNodes,
      companyIdentityIndex,
      core,
      fact.logos
    )
    upsertGameCompanyLink(
      gameCompanyLinks,
      companyIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )
  }

  for (const fact of bundle?.relationFacts?.gameCharacter ?? []) {
    const core = normalizeGameCharacterFactCore(fact)
    if (!core) continue

    const characterIdentityKey = upsertCharacterNode(
      characterNodes,
      characterIdentityIndex,
      core,
      fact.photos
    )
    upsertGameCharacterLink(
      gameCharacterLinks,
      characterIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )

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
      upsertGamePersonLink(
        gamePersonLinks,
        personIdentityKey,
        toGamePersonRoleFromCharacterPerson(personFact.role),
        personFact.isSpoiler,
        note
      )
      // Only a voice credit pairs a person with a character inside this entry;
      // an illustrator of the same character is not part of the cast.
      if (personFact.role === 'actor') {
        upsertGameCastLink(gameCastLinks, characterIdentityKey, personIdentityKey, note)
      }
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
    upsertGamePersonLink(
      gamePersonLinks,
      personIdentityKey,
      toGamePersonRoleFromCharacterPerson(fact.role),
      fact.isSpoiler,
      note
    )
    if (fact.role === 'actor') {
      upsertGameCastLink(gameCastLinks, characterIdentityKey, personIdentityKey, note)
    }
  }

  const media = bundle?.mediaCandidates

  return {
    game: {
      identityKey: gameIdentityKey,
      core: gameCore
    },
    persons: [...personNodes.values()].sort((a, b) => compareText(a.identityKey, b.identityKey)),
    companies: [...companyNodes.values()].sort((a, b) => compareText(a.identityKey, b.identityKey)),
    characters: [...characterNodes.values()].sort((a, b) =>
      compareText(a.identityKey, b.identityKey)
    ),
    links: {
      gamePerson: finalizeGamePersonLinks(gameIdentityKey, gamePersonLinks),
      gameCompany: finalizeGameCompanyLinks(gameIdentityKey, gameCompanyLinks),
      gameCharacter: finalizeGameCharacterLinks(gameIdentityKey, gameCharacterLinks),
      gameCast: finalizeGameCastLinks(gameIdentityKey, gameCastLinks),
      characterPerson: finalizeCharacterPersonLinks(characterPersonLinks)
    },
    relatedEntries: bundle?.relationFacts?.relatedEntries,
    media: {
      coverUrl: pickFirstUrl(media?.coverUrls),
      backdropUrl: pickFirstUrl(media?.backdropUrls),
      logoUrl: pickFirstUrl(media?.logoUrls),
      iconUrl: pickFirstUrl(media?.iconUrls)
    }
  }
}

export function buildGameGraph(bundle: ScrapedGameBundle, lookup: ScraperLookup): IngestGameGraph {
  return buildGameGraphInternal(bundle, lookup)
}

export function buildDirectGameGraph(lookup: ScraperLookup): IngestGameGraph {
  return buildGameGraphInternal(null, lookup)
}
