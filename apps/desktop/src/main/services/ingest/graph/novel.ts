import type {
  CharacterPersonRole,
  NovelCharacterRole,
  NovelCompanyRole,
  NovelPersonRole
} from '@shared/db'
import { buildEntityCanonicalIdentityKey } from '@shared/identity'
import { novelUnitIdentityKey } from '@shared/metadata'
import type {
  CoreCharacterMetadata,
  CoreCompanyMetadata,
  CoreNovelMetadata,
  CorePersonMetadata,
  NovelVolumeInfo
} from '@shared/metadata'
import type {
  IngestCharacterNode,
  IngestCharacterPersonLink,
  IngestCompanyNode,
  IngestNovelCharacterLink,
  IngestNovelCompanyLink,
  IngestNovelGraph,
  IngestNovelPersonLink,
  IngestPersonNode
} from './types'
import type {
  ScrapedNovelBundle,
  ScrapedNovelCharacterFact,
  ScrapedNovelCompanyFact,
  ScrapedNovelPersonFact,
  ScrapedCharacterPersonFact,
  ScraperLookup
} from '@shared/scraper'
import {
  compareText,
  createIdentityAliasIndex,
  firstNonEmpty,
  mergeExternalIds,
  normalizeCharacterCore,
  normalizeCompanyCore,
  normalizeNovelCore,
  normalizeOptionalString,
  normalizePersonCore,
  pickFirstUrl,
  upsertCharacterNode,
  upsertCompanyNode,
  upsertPersonNode
} from './shared'

interface PendingNovelPersonLink {
  personIdentityKey: string
  role: NovelPersonRole
  isSpoiler: boolean
  note?: string
}

interface PendingNovelCompanyLink {
  companyIdentityKey: string
  role: NovelCompanyRole
  isSpoiler: boolean
  note?: string
}

interface PendingNovelCharacterLink {
  characterIdentityKey: string
  role: NovelCharacterRole
  isSpoiler: boolean
  note?: string
}

interface PendingCharacterPersonLink {
  characterIdentityKey: string
  personIdentityKey: string
  role: CharacterPersonRole
  isSpoiler: boolean
  note?: string | undefined
}

/**
 * Coarsen a character credit into the novel staff vocabulary.
 *
 * Drawing and design work both read as illustrator credit on the entry. A
 * voice credit is not novel staff at all — it stays a knowledge-layer
 * character-person fact only, so this returns null for `actor`.
 */
function toNovelPersonRoleFromCharacterPerson(role: CharacterPersonRole): NovelPersonRole | null {
  switch (role) {
    case 'actor':
      return null
    case 'illustration':
    case 'designer':
      return 'illustrator'
    case 'other':
      return 'other'
  }
}

function upsertNovelPersonLink(
  edgeMap: Map<string, PendingNovelPersonLink>,
  personIdentityKey: string,
  role: NovelPersonRole,
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

function upsertNovelCompanyLink(
  edgeMap: Map<string, PendingNovelCompanyLink>,
  companyIdentityKey: string,
  role: NovelCompanyRole,
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

function upsertNovelCharacterLink(
  edgeMap: Map<string, PendingNovelCharacterLink>,
  characterIdentityKey: string,
  role: NovelCharacterRole,
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

function finalizeNovelPersonLinks(
  novelIdentityKey: string,
  edgeMap: Map<string, PendingNovelPersonLink>
): IngestNovelPersonLink[] {
  // Map iteration keeps the merged relation order from scraper results.
  const personOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge, orderInNovel) => {
    const orderInPerson = personOrderCounters.get(edge.personIdentityKey) ?? 0
    personOrderCounters.set(edge.personIdentityKey, orderInPerson + 1)

    return {
      novelIdentityKey,
      personIdentityKey: edge.personIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInNovel,
      orderInPerson
    }
  })
}

function finalizeNovelCompanyLinks(
  novelIdentityKey: string,
  edgeMap: Map<string, PendingNovelCompanyLink>
): IngestNovelCompanyLink[] {
  const companyOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge, orderInNovel) => {
    const orderInCompany = companyOrderCounters.get(edge.companyIdentityKey) ?? 0
    companyOrderCounters.set(edge.companyIdentityKey, orderInCompany + 1)

    return {
      novelIdentityKey,
      companyIdentityKey: edge.companyIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInNovel,
      orderInCompany
    }
  })
}

function finalizeNovelCharacterLinks(
  novelIdentityKey: string,
  edgeMap: Map<string, PendingNovelCharacterLink>
): IngestNovelCharacterLink[] {
  const characterOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge, orderInNovel) => {
    const orderInCharacter = characterOrderCounters.get(edge.characterIdentityKey) ?? 0
    characterOrderCounters.set(edge.characterIdentityKey, orderInCharacter + 1)

    return {
      novelIdentityKey,
      characterIdentityKey: edge.characterIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInNovel,
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

function toNovelRootCore(
  bundle: ScrapedNovelBundle | null,
  lookup: ScraperLookup
): CoreNovelMetadata {
  const normalized = normalizeNovelCore({
    ...(bundle?.core ?? {}),
    name: firstNonEmpty(bundle?.core?.name, lookup.name),
    externalIds: mergeExternalIds(bundle?.identity.externalIds, lookup.knownIds)
  })

  if (!normalized) {
    throw new Error('Ingest requires a non-empty novel name')
  }

  return normalized
}

function normalizeNovelPersonFactCore(fact: ScrapedNovelPersonFact): CorePersonMetadata | null {
  return normalizePersonCore({
    ...fact,
    externalIds: fact.identity.externalIds
  })
}

function normalizeNovelCompanyFactCore(fact: ScrapedNovelCompanyFact): CoreCompanyMetadata | null {
  return normalizeCompanyCore({
    ...fact,
    externalIds: fact.identity.externalIds
  })
}

function normalizeNovelCharacterFactCore(
  fact: ScrapedNovelCharacterFact
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
 * Normalize scraped volumes into ingest order.
 *
 * Sources revise numbering, so the stated number stays authoritative. Shared
 * with the update flow, which realigns stored rows against this list.
 */
export function normalizeNovelVolumes(
  volumes: NovelVolumeInfo[] | undefined
): NovelVolumeInfo[] | undefined {
  if (!volumes) return undefined

  const byKey = new Map<string, NovelVolumeInfo>()
  for (const volume of volumes) {
    const volumeNumber = Number.isFinite(volume.volumeNumber) ? volume.volumeNumber : undefined
    const name = normalizeOptionalString(volume.name)
    if (volumeNumber === undefined && !name) continue

    const normalized: NovelVolumeInfo = {
      volumeNumber,
      name,
      originalName: normalizeOptionalString(volume.originalName),
      releaseDate: volume.releaseDate,
      description: normalizeOptionalString(volume.description),
      coverUrl: normalizeOptionalString(volume.coverUrl),
      externalIds: mergeExternalIds(undefined, volume.externalIds)
    }
    byKey.set(novelUnitIdentityKey(normalized), normalized)
  }

  return [...byKey.values()].sort(
    (a, b) =>
      (a.volumeNumber ?? Number.POSITIVE_INFINITY) - (b.volumeNumber ?? Number.POSITIVE_INFINITY)
  )
}

function buildNovelGraphInternal(
  bundle: ScrapedNovelBundle | null,
  lookup: ScraperLookup
): IngestNovelGraph {
  const novelCore = toNovelRootCore(bundle, lookup)
  const novelIdentityKey = buildEntityCanonicalIdentityKey(novelCore)

  const personNodes = new Map<string, IngestPersonNode>()
  const companyNodes = new Map<string, IngestCompanyNode>()
  const characterNodes = new Map<string, IngestCharacterNode>()
  const personIdentityIndex = createIdentityAliasIndex()
  const companyIdentityIndex = createIdentityAliasIndex()
  const characterIdentityIndex = createIdentityAliasIndex()
  const novelPersonLinks = new Map<string, PendingNovelPersonLink>()
  const novelCompanyLinks = new Map<string, PendingNovelCompanyLink>()
  const novelCharacterLinks = new Map<string, PendingNovelCharacterLink>()
  const characterPersonLinks = new Map<string, PendingCharacterPersonLink>()

  for (const fact of bundle?.relationFacts?.novelPerson ?? []) {
    const core = normalizeNovelPersonFactCore(fact)
    if (!core) continue

    const personIdentityKey = upsertPersonNode(personNodes, personIdentityIndex, core, fact.photos)
    upsertNovelPersonLink(
      novelPersonLinks,
      personIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )
  }

  for (const fact of bundle?.relationFacts?.novelCompany ?? []) {
    const core = normalizeNovelCompanyFactCore(fact)
    if (!core) continue

    const companyIdentityKey = upsertCompanyNode(
      companyNodes,
      companyIdentityIndex,
      core,
      fact.logos
    )
    upsertNovelCompanyLink(
      novelCompanyLinks,
      companyIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )
  }

  for (const fact of bundle?.relationFacts?.novelCharacter ?? []) {
    const core = normalizeNovelCharacterFactCore(fact)
    if (!core) continue

    const characterIdentityKey = upsertCharacterNode(
      characterNodes,
      characterIdentityIndex,
      core,
      fact.photos
    )
    upsertNovelCharacterLink(
      novelCharacterLinks,
      characterIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )

    // Character-person facts always feed the knowledge layer; only roles with a
    // novel staff meaning also become entry credits. Voice credits stay
    // knowledge-only — print media has no cast.
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
      const novelRole = toNovelPersonRoleFromCharacterPerson(personFact.role)
      if (novelRole) {
        upsertNovelPersonLink(
          novelPersonLinks,
          personIdentityKey,
          novelRole,
          personFact.isSpoiler,
          note
        )
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
    const novelRole = toNovelPersonRoleFromCharacterPerson(fact.role)
    if (novelRole) {
      upsertNovelPersonLink(novelPersonLinks, personIdentityKey, novelRole, fact.isSpoiler, note)
    }
  }

  const media = bundle?.mediaCandidates

  return {
    novel: {
      identityKey: novelIdentityKey,
      core: novelCore
    },
    volumes: normalizeNovelVolumes(bundle?.volumes),
    persons: [...personNodes.values()].sort((a, b) => compareText(a.identityKey, b.identityKey)),
    companies: [...companyNodes.values()].sort((a, b) => compareText(a.identityKey, b.identityKey)),
    characters: [...characterNodes.values()].sort((a, b) =>
      compareText(a.identityKey, b.identityKey)
    ),
    links: {
      novelPerson: finalizeNovelPersonLinks(novelIdentityKey, novelPersonLinks),
      novelCompany: finalizeNovelCompanyLinks(novelIdentityKey, novelCompanyLinks),
      novelCharacter: finalizeNovelCharacterLinks(novelIdentityKey, novelCharacterLinks),
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

export function buildNovelGraph(
  bundle: ScrapedNovelBundle,
  lookup: ScraperLookup
): IngestNovelGraph {
  return buildNovelGraphInternal(bundle, lookup)
}

export function buildDirectNovelGraph(lookup: ScraperLookup): IngestNovelGraph {
  return buildNovelGraphInternal(null, lookup)
}
