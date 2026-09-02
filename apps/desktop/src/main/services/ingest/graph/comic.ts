import type {
  CharacterPersonRole,
  ComicCharacterRole,
  ComicCompanyRole,
  ComicPersonRole
} from '@shared/db'
import { buildEntityCanonicalIdentityKey } from '@shared/identity'
import { comicUnitIdentityKey } from '@shared/metadata'
import type {
  ComicChapterInfo,
  CoreCharacterMetadata,
  CoreComicMetadata,
  CoreCompanyMetadata,
  CorePersonMetadata
} from '@shared/metadata'
import type {
  IngestCharacterNode,
  IngestCharacterPersonLink,
  IngestComicCharacterLink,
  IngestComicCompanyLink,
  IngestComicGraph,
  IngestComicPersonLink,
  IngestCompanyNode,
  IngestPersonNode
} from './types'
import type {
  ScrapedComicBundle,
  ScrapedComicCharacterFact,
  ScrapedComicCompanyFact,
  ScrapedComicPersonFact,
  ScrapedCharacterPersonFact,
  ScraperLookup
} from '@shared/scraper'
import {
  compareText,
  createIdentityAliasIndex,
  firstNonEmpty,
  mergeExternalIds,
  normalizeCharacterCore,
  normalizeComicCore,
  normalizeCompanyCore,
  normalizeOptionalString,
  normalizePersonCore,
  pickFirstUrl,
  upsertCharacterNode,
  upsertCompanyNode,
  upsertPersonNode
} from './shared'

interface PendingComicPersonLink {
  personIdentityKey: string
  role: ComicPersonRole
  isSpoiler: boolean
  note?: string
}

interface PendingComicCompanyLink {
  companyIdentityKey: string
  role: ComicCompanyRole
  isSpoiler: boolean
  note?: string
}

interface PendingComicCharacterLink {
  characterIdentityKey: string
  role: ComicCharacterRole
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
 * Coarsen a character credit into the comic staff vocabulary.
 *
 * Drawing and design work both read as art credit on the entry. A voice
 * credit is not comic staff at all — it stays a knowledge-layer
 * character-person fact only, so this returns null for `actor`.
 */
function toComicPersonRoleFromCharacterPerson(role: CharacterPersonRole): ComicPersonRole | null {
  switch (role) {
    case 'actor':
      return null
    case 'illustration':
    case 'designer':
      return 'art'
    case 'other':
      return 'other'
  }
}

function upsertComicPersonLink(
  edgeMap: Map<string, PendingComicPersonLink>,
  personIdentityKey: string,
  role: ComicPersonRole,
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

function upsertComicCompanyLink(
  edgeMap: Map<string, PendingComicCompanyLink>,
  companyIdentityKey: string,
  role: ComicCompanyRole,
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

function upsertComicCharacterLink(
  edgeMap: Map<string, PendingComicCharacterLink>,
  characterIdentityKey: string,
  role: ComicCharacterRole,
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

function finalizeComicPersonLinks(
  comicIdentityKey: string,
  edgeMap: Map<string, PendingComicPersonLink>
): IngestComicPersonLink[] {
  // Map iteration keeps the merged relation order from scraper results.
  const personOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge, orderInComic) => {
    const orderInPerson = personOrderCounters.get(edge.personIdentityKey) ?? 0
    personOrderCounters.set(edge.personIdentityKey, orderInPerson + 1)

    return {
      comicIdentityKey,
      personIdentityKey: edge.personIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInComic,
      orderInPerson
    }
  })
}

function finalizeComicCompanyLinks(
  comicIdentityKey: string,
  edgeMap: Map<string, PendingComicCompanyLink>
): IngestComicCompanyLink[] {
  const companyOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge, orderInComic) => {
    const orderInCompany = companyOrderCounters.get(edge.companyIdentityKey) ?? 0
    companyOrderCounters.set(edge.companyIdentityKey, orderInCompany + 1)

    return {
      comicIdentityKey,
      companyIdentityKey: edge.companyIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInComic,
      orderInCompany
    }
  })
}

function finalizeComicCharacterLinks(
  comicIdentityKey: string,
  edgeMap: Map<string, PendingComicCharacterLink>
): IngestComicCharacterLink[] {
  const characterOrderCounters = new Map<string, number>()

  return [...edgeMap.values()].map((edge, orderInComic) => {
    const orderInCharacter = characterOrderCounters.get(edge.characterIdentityKey) ?? 0
    characterOrderCounters.set(edge.characterIdentityKey, orderInCharacter + 1)

    return {
      comicIdentityKey,
      characterIdentityKey: edge.characterIdentityKey,
      role: edge.role,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInComic,
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

function toComicRootCore(
  bundle: ScrapedComicBundle | null,
  lookup: ScraperLookup
): CoreComicMetadata {
  const normalized = normalizeComicCore({
    ...(bundle?.core ?? {}),
    name: firstNonEmpty(bundle?.core?.name, lookup.name),
    externalIds: mergeExternalIds(bundle?.identity.externalIds, lookup.knownIds)
  })

  if (!normalized) {
    throw new Error('Ingest requires a non-empty comic name')
  }

  return normalized
}

function normalizeComicPersonFactCore(fact: ScrapedComicPersonFact): CorePersonMetadata | null {
  return normalizePersonCore({
    ...fact,
    externalIds: fact.identity.externalIds
  })
}

function normalizeComicCompanyFactCore(fact: ScrapedComicCompanyFact): CoreCompanyMetadata | null {
  return normalizeCompanyCore({
    ...fact,
    externalIds: fact.identity.externalIds
  })
}

function normalizeComicCharacterFactCore(
  fact: ScrapedComicCharacterFact
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
 * Normalize scraped units into ingest order.
 *
 * Sources revise numbering, so the stated numbers stay authoritative while
 * grain keeps volume and chapter runs in separate sequences. Shared with the
 * update flow, which realigns stored rows against this list.
 */
export function normalizeComicChapters(
  chapters: ComicChapterInfo[] | undefined
): ComicChapterInfo[] | undefined {
  if (!chapters) return undefined

  const byKey = new Map<string, ComicChapterInfo>()
  for (const chapter of chapters) {
    const volumeNumber = Number.isFinite(chapter.volumeNumber) ? chapter.volumeNumber : undefined
    const chapterNumber = Number.isFinite(chapter.chapterNumber) ? chapter.chapterNumber : undefined
    const name = normalizeOptionalString(chapter.name)
    if (volumeNumber === undefined && chapterNumber === undefined && !name) continue

    const normalized: ComicChapterInfo = {
      volumeNumber,
      chapterNumber,
      name,
      originalName: normalizeOptionalString(chapter.originalName),
      releaseDate: chapter.releaseDate,
      description: normalizeOptionalString(chapter.description),
      coverUrl: normalizeOptionalString(chapter.coverUrl),
      externalIds: mergeExternalIds(undefined, chapter.externalIds)
    }
    byKey.set(comicUnitIdentityKey(normalized), normalized)
  }

  // Volume-grained rows sort before chapter-grained ones; numbers order within.
  return [...byKey.values()].sort((a, b) => {
    const aGrain = a.chapterNumber != null ? 1 : 0
    const bGrain = b.chapterNumber != null ? 1 : 0
    if (aGrain !== bGrain) return aGrain - bGrain
    const aNumber = a.chapterNumber ?? a.volumeNumber ?? Number.POSITIVE_INFINITY
    const bNumber = b.chapterNumber ?? b.volumeNumber ?? Number.POSITIVE_INFINITY
    return aNumber - bNumber
  })
}

function buildComicGraphInternal(
  bundle: ScrapedComicBundle | null,
  lookup: ScraperLookup
): IngestComicGraph {
  const comicCore = toComicRootCore(bundle, lookup)
  const comicIdentityKey = buildEntityCanonicalIdentityKey(comicCore)

  const personNodes = new Map<string, IngestPersonNode>()
  const companyNodes = new Map<string, IngestCompanyNode>()
  const characterNodes = new Map<string, IngestCharacterNode>()
  const personIdentityIndex = createIdentityAliasIndex()
  const companyIdentityIndex = createIdentityAliasIndex()
  const characterIdentityIndex = createIdentityAliasIndex()
  const comicPersonLinks = new Map<string, PendingComicPersonLink>()
  const comicCompanyLinks = new Map<string, PendingComicCompanyLink>()
  const comicCharacterLinks = new Map<string, PendingComicCharacterLink>()
  const characterPersonLinks = new Map<string, PendingCharacterPersonLink>()

  for (const fact of bundle?.relationFacts?.comicPerson ?? []) {
    const core = normalizeComicPersonFactCore(fact)
    if (!core) continue

    const personIdentityKey = upsertPersonNode(personNodes, personIdentityIndex, core, fact.photos)
    upsertComicPersonLink(
      comicPersonLinks,
      personIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )
  }

  for (const fact of bundle?.relationFacts?.comicCompany ?? []) {
    const core = normalizeComicCompanyFactCore(fact)
    if (!core) continue

    const companyIdentityKey = upsertCompanyNode(
      companyNodes,
      companyIdentityIndex,
      core,
      fact.logos
    )
    upsertComicCompanyLink(
      comicCompanyLinks,
      companyIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )
  }

  for (const fact of bundle?.relationFacts?.comicCharacter ?? []) {
    const core = normalizeComicCharacterFactCore(fact)
    if (!core) continue

    const characterIdentityKey = upsertCharacterNode(
      characterNodes,
      characterIdentityIndex,
      core,
      fact.photos
    )
    upsertComicCharacterLink(
      comicCharacterLinks,
      characterIdentityKey,
      fact.role,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )

    // Character-person facts always feed the knowledge layer; only roles with a
    // comic staff meaning also become entry credits. Voice credits stay
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
      const comicRole = toComicPersonRoleFromCharacterPerson(personFact.role)
      if (comicRole) {
        upsertComicPersonLink(
          comicPersonLinks,
          personIdentityKey,
          comicRole,
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
    const comicRole = toComicPersonRoleFromCharacterPerson(fact.role)
    if (comicRole) {
      upsertComicPersonLink(comicPersonLinks, personIdentityKey, comicRole, fact.isSpoiler, note)
    }
  }

  const media = bundle?.mediaCandidates

  return {
    comic: {
      identityKey: comicIdentityKey,
      core: comicCore
    },
    chapters: normalizeComicChapters(bundle?.chapters),
    persons: [...personNodes.values()].sort((a, b) => compareText(a.identityKey, b.identityKey)),
    companies: [...companyNodes.values()].sort((a, b) => compareText(a.identityKey, b.identityKey)),
    characters: [...characterNodes.values()].sort((a, b) =>
      compareText(a.identityKey, b.identityKey)
    ),
    links: {
      comicPerson: finalizeComicPersonLinks(comicIdentityKey, comicPersonLinks),
      comicCompany: finalizeComicCompanyLinks(comicIdentityKey, comicCompanyLinks),
      comicCharacter: finalizeComicCharacterLinks(comicIdentityKey, comicCharacterLinks),
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

export function buildComicGraph(
  bundle: ScrapedComicBundle,
  lookup: ScraperLookup
): IngestComicGraph {
  return buildComicGraphInternal(bundle, lookup)
}

export function buildDirectComicGraph(lookup: ScraperLookup): IngestComicGraph {
  return buildComicGraphInternal(null, lookup)
}
