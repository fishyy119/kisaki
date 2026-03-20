import type {
  CharacterPersonType,
  GameCharacterType,
  GameCompanyType,
  GamePersonType
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
  IngestGameCharacterLink,
  IngestGameCharacterPersonLink,
  IngestGameCompanyLink,
  IngestGamePersonLink,
  NormalizedCharacterNode,
  NormalizedCompanyNode,
  NormalizedPersonNode
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
  type: GamePersonType
  isSpoiler: boolean
  note?: string
}

interface PendingGameCompanyLink {
  companyIdentityKey: string
  type: GameCompanyType
  isSpoiler: boolean
  note?: string
}

interface PendingGameCharacterLink {
  characterIdentityKey: string
  type: GameCharacterType
  isSpoiler: boolean
  note?: string
}

interface PendingCharacterPersonLink {
  characterIdentityKey: string
  personIdentityKey: string
  type: CharacterPersonType
  isSpoiler: boolean
  note?: string
}

function toGamePersonTypeFromCharacterPerson(type: CharacterPersonType): GamePersonType {
  switch (type) {
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
  type: GamePersonType,
  isSpoiler: boolean | undefined,
  note: string | undefined
): void {
  const key = `${personIdentityKey}:${type}`
  const existing = edgeMap.get(key)
  if (!existing) {
    edgeMap.set(key, {
      personIdentityKey,
      type,
      isSpoiler: !!isSpoiler,
      note: normalizeOptionalString(note)
    })
    return
  }

  existing.isSpoiler = existing.isSpoiler || !!isSpoiler
  existing.note = firstNonEmpty(existing.note, note)
}

function upsertGameCompanyLink(
  edgeMap: Map<string, PendingGameCompanyLink>,
  companyIdentityKey: string,
  type: GameCompanyType,
  isSpoiler: boolean | undefined,
  note: string | undefined
): void {
  const key = `${companyIdentityKey}:${type}`
  const existing = edgeMap.get(key)
  if (!existing) {
    edgeMap.set(key, {
      companyIdentityKey,
      type,
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
  type: GameCharacterType,
  isSpoiler: boolean | undefined,
  note: string | undefined
): void {
  const key = `${characterIdentityKey}:${type}`
  const existing = edgeMap.get(key)
  if (!existing) {
    edgeMap.set(key, {
      characterIdentityKey,
      type,
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
  type: CharacterPersonType,
  isSpoiler: boolean | undefined,
  note: string | undefined
): void {
  const key = `${characterIdentityKey}:${personIdentityKey}:${type}`
  const existing = edgeMap.get(key)
  if (!existing) {
    edgeMap.set(key, {
      characterIdentityKey,
      personIdentityKey,
      type,
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
      type: edge.type,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInGame,
      orderInPerson
    }
  })
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
      type: edge.type,
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
      type: edge.type,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInGame,
      orderInCharacter
    }
  })
}

function finalizeCharacterPersonLinks(
  edgeMap: Map<string, PendingCharacterPersonLink>
): IngestGameCharacterPersonLink[] {
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
      type: edge.type,
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
    externalIds: mergeExternalIds(bundle?.core?.externalIds, lookup.knownIds)
  })

  if (!normalized) {
    throw new Error('Ingest requires a non-empty game name')
  }

  return normalized
}

function normalizeGamePersonFactCore(fact: ScrapedGamePersonFact): CorePersonMetadata | null {
  return normalizePersonCore(fact)
}

function normalizeGameCompanyFactCore(fact: ScrapedGameCompanyFact): CoreCompanyMetadata | null {
  return normalizeCompanyCore(fact)
}

function normalizeGameCharacterFactCore(
  fact: ScrapedGameCharacterFact
): CoreCharacterMetadata | null {
  return normalizeCharacterCore(fact)
}

function normalizeCharacterPersonFactCore(
  fact: ScrapedCharacterPersonFact
): CorePersonMetadata | null {
  return normalizePersonCore(fact)
}

function buildGameGraphInternal(
  bundle: ScrapedGameBundle | null,
  lookup: ScraperLookup
): IngestGameGraph {
  const gameCore = toGameRootCore(bundle, lookup)
  const gameIdentityKey = buildEntityCanonicalIdentityKey(gameCore)

  const personNodes = new Map<string, NormalizedPersonNode>()
  const companyNodes = new Map<string, NormalizedCompanyNode>()
  const characterNodes = new Map<string, NormalizedCharacterNode>()
  const personIdentityIndex = createIdentityAliasIndex()
  const companyIdentityIndex = createIdentityAliasIndex()
  const characterIdentityIndex = createIdentityAliasIndex()
  const gamePersonLinks = new Map<string, PendingGamePersonLink>()
  const gameCompanyLinks = new Map<string, PendingGameCompanyLink>()
  const gameCharacterLinks = new Map<string, PendingGameCharacterLink>()
  const characterPersonLinks = new Map<string, PendingCharacterPersonLink>()

  for (const fact of bundle?.relationFacts?.gamePerson ?? []) {
    const core = normalizeGamePersonFactCore(fact)
    if (!core) continue

    const personIdentityKey = upsertPersonNode(personNodes, personIdentityIndex, core, fact.photos)
    upsertGamePersonLink(
      gamePersonLinks,
      personIdentityKey,
      fact.type,
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
      fact.type,
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
      fact.type,
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
        personFact.type,
        personFact.isSpoiler,
        note
      )
      upsertGamePersonLink(
        gamePersonLinks,
        personIdentityKey,
        toGamePersonTypeFromCharacterPerson(personFact.type),
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

    const characterCore = fact.character ? normalizeCharacterCore(fact.character) : null
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
      fact.type,
      fact.isSpoiler,
      note
    )
    upsertGamePersonLink(
      gamePersonLinks,
      personIdentityKey,
      toGamePersonTypeFromCharacterPerson(fact.type),
      fact.isSpoiler,
      note
    )
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
      characterPerson: finalizeCharacterPersonLinks(characterPersonLinks)
    },
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
