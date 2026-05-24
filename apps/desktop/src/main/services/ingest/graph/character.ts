import type { CharacterPersonType } from '@shared/db'
import { buildEntityCanonicalIdentityKey } from '@shared/identity'
import type { CoreCharacterMetadata, CorePersonMetadata } from '@shared/metadata'
import type {
  ScrapedCharacterBundle,
  ScrapedCharacterPersonFact,
  ScraperLookup
} from '@shared/scraper'
import type { IngestCharacterGraph, IngestCharacterPersonLink, NormalizedPersonNode } from './types'
import {
  compareText,
  createIdentityAliasIndex,
  firstNonEmpty,
  mergeExternalIds,
  normalizeCharacterCore,
  normalizeOptionalString,
  normalizePersonCore,
  pickFirstUrl,
  upsertPersonNode
} from './common'

interface PendingCharacterPersonLink {
  characterIdentityKey: string
  personIdentityKey: string
  type: CharacterPersonType
  isSpoiler: boolean
  note?: string
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

function finalizeCharacterGraphLinks(
  characterIdentityKey: string,
  edgeMap: Map<string, PendingCharacterPersonLink>
): IngestCharacterPersonLink[] {
  // Preserve the merged relation order from scraper results.
  // Map iteration keeps first-insertion order, which matches the first appearance
  // order established during merge/deduplication.
  const ordered = [...edgeMap.values()]

  const personOrderCounters = new Map<string, number>()

  return ordered.map((edge, orderInCharacter) => {
    const orderInPerson = personOrderCounters.get(edge.personIdentityKey) ?? 0
    personOrderCounters.set(edge.personIdentityKey, orderInPerson + 1)

    return {
      characterIdentityKey,
      personIdentityKey: edge.personIdentityKey,
      type: edge.type,
      isSpoiler: edge.isSpoiler,
      note: edge.note,
      orderInCharacter,
      orderInPerson
    }
  })
}

function toCharacterRootCore(
  bundle: ScrapedCharacterBundle,
  lookup: ScraperLookup
): CoreCharacterMetadata {
  const normalized = normalizeCharacterCore({
    ...(bundle.core ?? {}),
    name: firstNonEmpty(bundle.core?.name, lookup.name),
    externalIds: mergeExternalIds(bundle.identity.externalIds, lookup.knownIds)
  })

  if (!normalized) {
    throw new Error('Ingest requires a non-empty character name')
  }

  return normalized
}

function normalizeCharacterPersonFactCore(
  fact: ScrapedCharacterPersonFact
): CorePersonMetadata | null {
  return normalizePersonCore({
    ...fact,
    externalIds: fact.identity.externalIds
  })
}

export function buildCharacterGraph(
  bundle: ScrapedCharacterBundle,
  lookup: ScraperLookup
): IngestCharacterGraph {
  const characterCore = toCharacterRootCore(bundle, lookup)
  const characterIdentityKey = buildEntityCanonicalIdentityKey(characterCore)

  const personNodes = new Map<string, NormalizedPersonNode>()
  const personIdentityIndex = createIdentityAliasIndex()
  const characterPersonLinks = new Map<string, PendingCharacterPersonLink>()

  for (const fact of bundle.relationFacts?.characterPerson ?? []) {
    const core = normalizeCharacterPersonFactCore(fact)
    if (!core) continue

    const personIdentityKey = upsertPersonNode(personNodes, personIdentityIndex, core, fact.photos)
    upsertCharacterPersonLink(
      characterPersonLinks,
      characterIdentityKey,
      personIdentityKey,
      fact.type,
      fact.isSpoiler,
      normalizeOptionalString(fact.note)
    )
  }

  const photoUrl = pickFirstUrl(bundle.mediaCandidates?.photoUrls)

  return {
    character: {
      identityKey: characterIdentityKey,
      core: characterCore,
      photoUrls: photoUrl ? [photoUrl] : undefined
    },
    persons: [...personNodes.values()].sort((a, b) => compareText(a.identityKey, b.identityKey)),
    links: finalizeCharacterGraphLinks(characterIdentityKey, characterPersonLinks)
  }
}
