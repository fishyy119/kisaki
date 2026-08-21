import type { ExternalSite, SlotStrategy, UnmatchedEntityPolicy } from '@shared/db'
import type {
  ScrapedEntityIdentity,
  ScrapedCharacterMetadata,
  ScrapedCharacterPersonFact,
  ScrapedCompanyMetadata,
  ScrapedPersonMetadata
} from '@shared/scraper'
import type { Tag } from '@shared/metadata'
import {
  buildEntityAliasKeys,
  normalizeExternalIds,
  normalizeKeyText,
  type ExternalId
} from '@shared/identity'
import { mergeScrapedIdentities } from './identity'

interface MergeIdentityEntityBase {
  name: string
  originalName?: string
  identity?: ScrapedEntityIdentity
}

export interface MergeIdentityEntity extends MergeIdentityEntityBase {
  type: string
}

interface AnchoredEntity<T> {
  item: T
  keys: Set<string>
}

type KeyBuilder<T> = (item: T) => string[]

type EntityMerger<T> = (existing: T, incoming: T) => T

export interface RelationCollectionMergeOptions {
  strategy: SlotStrategy
  unmatchedEntityPolicy: UnmatchedEntityPolicy
}

function toEntityIdentityInput(entity: MergeIdentityEntityBase) {
  return {
    name: entity.name,
    originalName: entity.originalName,
    externalIds: entity.identity?.externalIds
  }
}

export function buildScrapedEntityAliasKeys(
  entity: MergeIdentityEntityBase,
  options: {
    includeCompactFallbackKeys?: boolean
    type?: string
  } = {}
): string[] {
  return buildEntityAliasKeys(toEntityIdentityInput(entity), options)
}

function deduplicate<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = keyFn(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Sort results by runtime execution rank (ascending).
 */
export function sortByRank<T extends { rank: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.rank - b.rank)
}

/**
 * Filter a discriminated-union result array by slot.
 */
export function filterBySlot<R extends { slot: string }, S extends R['slot']>(
  results: readonly R[],
  slot: S
): Extract<R, { slot: S }>[] {
  return results.filter((r): r is Extract<R, { slot: S }> => r.slot === slot)
}

function mergeArrays<T>(existing: T[], incoming: T[], keyFn: (item: T) => string): T[] {
  return deduplicate([...existing, ...incoming], keyFn)
}

function registerAnchorKeys(
  keyToAnchorIndexes: Map<string, Set<number>>,
  anchorIndex: number,
  keys: Iterable<string>
): void {
  for (const key of keys) {
    let indexes = keyToAnchorIndexes.get(key)
    if (!indexes) {
      indexes = new Set<number>()
      keyToAnchorIndexes.set(key, indexes)
    }
    indexes.add(anchorIndex)
  }
}

function buildAnchoredEntities<T>(
  items: T[],
  keyBuilder: KeyBuilder<T>
): {
  anchors: AnchoredEntity<T>[]
  keyToAnchorIndexes: Map<string, Set<number>>
} {
  const anchors = items.map((item) => ({
    item,
    keys: new Set(keyBuilder(item))
  }))
  const keyToAnchorIndexes = new Map<string, Set<number>>()

  anchors.forEach((anchor, index) => {
    registerAnchorKeys(keyToAnchorIndexes, index, anchor.keys)
  })

  return { anchors, keyToAnchorIndexes }
}

function getAliasKeyStrength(key: string): number {
  const typeSeparatorIndex = key.indexOf('|')
  const baseKey = typeSeparatorIndex >= 0 ? key.slice(0, typeSeparatorIndex) : key

  if (baseKey.startsWith('ext:')) return 3
  if (baseKey.startsWith('on:') || baseKey.startsWith('nm:')) return 2
  if (baseKey.startsWith('onc:') || baseKey.startsWith('nmc:')) return 1
  return 0
}

function findBestAnchorMatch(
  keys: string[],
  keyToAnchorIndexes: Map<string, Set<number>>
): number | null {
  const scores = new Map<number, number>()

  for (const key of keys) {
    const strength = getAliasKeyStrength(key)
    if (!strength) continue

    const anchorIndexes = keyToAnchorIndexes.get(key)
    if (!anchorIndexes) continue

    for (const anchorIndex of anchorIndexes) {
      const current = scores.get(anchorIndex) ?? 0
      if (strength > current) {
        scores.set(anchorIndex, strength)
      }
    }
  }

  if (scores.size === 0) {
    return null
  }

  const rankedMatches = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])
  const [bestAnchorIndex, bestScore] = rankedMatches[0]

  if (
    rankedMatches.some(
      ([anchorIndex, score]) => anchorIndex !== bestAnchorIndex && score === bestScore
    )
  ) {
    return null
  }

  return bestAnchorIndex
}

/**
 * Reconcile provider entities against the current anchor set.
 *
 * Existing items define the current entity boundary. Incoming items can enrich matched anchors,
 * and may append unmatched entities when the slot policy allows it.
 */
export function reconcileEntitiesByKeys<T>(
  existing: T[],
  incoming: T[],
  keyBuilder: KeyBuilder<T>,
  mergeFn: EntityMerger<T>,
  allowExpansion: boolean
): T[] {
  if (!existing.length) {
    return incoming
  }

  const { anchors, keyToAnchorIndexes } = buildAnchoredEntities(existing, keyBuilder)

  for (const item of incoming) {
    const keys = keyBuilder(item)
    const matchedAnchorIndex = findBestAnchorMatch(keys, keyToAnchorIndexes)

    if (matchedAnchorIndex == null) {
      if (!allowExpansion) continue

      const anchorIndex = anchors.length
      const anchor: AnchoredEntity<T> = {
        item,
        keys: new Set(keys)
      }

      anchors.push(anchor)
      registerAnchorKeys(keyToAnchorIndexes, anchorIndex, anchor.keys)
      continue
    }

    const anchor = anchors[matchedAnchorIndex]
    anchor.item = mergeFn(anchor.item, item)

    registerAnchorKeys(keyToAnchorIndexes, matchedAnchorIndex, keys)
    for (const key of keys) {
      anchor.keys.add(key)
    }

    const mergedKeys = keyBuilder(anchor.item)
    registerAnchorKeys(keyToAnchorIndexes, matchedAnchorIndex, mergedKeys)
    for (const key of mergedKeys) {
      anchor.keys.add(key)
    }
  }

  return anchors.map((anchor) => anchor.item)
}

/**
 * Merge scalar fields from incoming to existing (fill-in-the-blanks).
 * Existing values take priority, only fills undefined/null/empty fields.
 */
export function mergeScalarFields<T extends object>(
  existing: T,
  incoming: T,
  excludeKeys: (keyof T)[]
): T {
  const result = { ...existing }
  const exclude = new Set(excludeKeys)

  for (const key of Object.keys(incoming) as (keyof T)[]) {
    if (exclude.has(key)) continue

    const existingVal = existing[key]
    const incomingVal = incoming[key]

    if (existingVal === undefined || existingVal === null || existingVal === '') {
      result[key] = incomingVal
    }
  }

  return result
}

/**
 * Merge ExternalId arrays with deduplication by source:id.
 */
export function mergeExternalIds(
  existing: ExternalId[] | undefined,
  incoming: ExternalId[] | undefined
): ExternalId[] {
  if (!existing?.length && !incoming?.length) return []
  return normalizeExternalIds([...(existing ?? []), ...(incoming ?? [])])
}

/**
 * Merge ExternalSite arrays with deduplication by url.
 *
 * Presence is preserved: the result is `undefined` only when neither side knows
 * the collection, so an authoritative empty answer stays empty.
 */
export function mergeExternalSites(
  existing: ExternalSite[] | undefined,
  incoming: ExternalSite[] | undefined
): ExternalSite[] | undefined {
  if (!existing && !incoming) return undefined
  return mergeArrays(existing ?? [], incoming ?? [], (s) => s.url)
}

/**
 * Merge Tag arrays with deduplication by name.
 */
export function mergeTagsArray(
  existing: Tag[] | undefined,
  incoming: Tag[] | undefined
): Tag[] | undefined {
  if (!existing && !incoming) return undefined
  return mergeArrays(existing ?? [], incoming ?? [], (t) => t.name)
}

/**
 * Merge image URL arrays with deduplication by URL.
 */
export function mergeImageUrls(
  existing: string[] | undefined,
  incoming: string[] | undefined
): string[] | undefined {
  if (!existing && !incoming) return undefined
  return [...new Set([...(existing ?? []), ...(incoming ?? [])])]
}

/**
 * Fold every provider result for one collection slot into the merged value.
 *
 * Slot presence carries the authority: `undefined` means no consulted provider
 * answered, while an array means at least one did, so a slot every provider
 * reported as empty stays an authoritative empty collection instead of decaying
 * into "unknown". Empty answers never satisfy `first`, so the next provider is
 * still consulted.
 */
export function foldCollectionResults<TItem, TResult extends { rank: number; data: TItem[] }>(
  results: readonly TResult[],
  strategy: SlotStrategy,
  apply: (merged: TItem[], result: TResult) => TItem[]
): TItem[] | undefined {
  const sorted = sortByRank(results)
  if (sorted.length === 0) {
    return undefined
  }

  let merged: TItem[] = []

  for (const result of sorted) {
    if (result.data.length === 0) {
      continue
    }

    merged = apply(merged, result)

    if (strategy === 'first' && merged.length > 0) {
      break
    }
  }

  return merged
}

/**
 * Apply strategy for simple arrays (tags, etc.) - dedup by key only.
 */
export function applyStrategy<T>(
  existing: T[] | undefined,
  incoming: T[],
  strategy: SlotStrategy,
  keyFn: (item: T) => string
): T[] {
  const existingArr = existing ?? []

  switch (strategy) {
    case 'first':
      return existingArr.length ? existingArr : incoming
    case 'enrich':
      return deduplicate([...existingArr, ...incoming], keyFn)
  }
}

/**
 * Apply strategy for image arrays.
 */
export function applyImageStrategy(
  existing: string[] | undefined,
  incoming: string[],
  strategy: SlotStrategy
): string[] {
  const existingArr = existing ?? []

  switch (strategy) {
    case 'first':
      return existingArr.length ? existingArr : incoming
    case 'enrich':
      return [...new Set([...existingArr, ...incoming])]
  }
}

/**
 * Apply strategy for relation collections (characters, persons, companies).
 */
export function applyEntityCollectionStrategy<T>(
  existing: T[] | undefined,
  incoming: T[],
  options: RelationCollectionMergeOptions,
  keyBuilder: (item: T) => string[],
  mergeFn: (existing: T, incoming: T) => T
): T[] {
  const existingArr = existing ?? []

  switch (options.strategy) {
    case 'first':
      return existingArr.length ? existingArr : incoming

    case 'enrich':
      return reconcileEntitiesByKeys(
        existingArr,
        incoming,
        keyBuilder,
        mergeFn,
        options.unmatchedEntityPolicy === 'append'
      )
  }
}

// =============================================================================
// Field-Level Metadata Mergers (shared across handler mergers)
// =============================================================================

/**
 * Merge CorePersonMetadata fields (fill-in-the-blanks + array merge).
 */
export function mergePersonMetadataFields(
  existing: ScrapedPersonMetadata,
  incoming: ScrapedPersonMetadata
): ScrapedPersonMetadata {
  const merged = mergeScalarFields(existing, incoming, [
    'identity',
    'aliases',
    'externalSites',
    'tags',
    'photos'
  ])

  return {
    ...merged,
    identity: mergeScrapedIdentities(existing.identity, incoming.identity),
    aliases: mergeAliases(existing.aliases, incoming.aliases),
    externalSites: mergeExternalSites(existing.externalSites, incoming.externalSites),
    tags: mergeTagsArray(existing.tags, incoming.tags),
    photos: mergeImageUrls(existing.photos, incoming.photos)
  }
}

/**
 * Union the alternate names two sources credit an entity under.
 *
 * Every source's alias is true, so unlike scalar fields these accumulate;
 * absent on both sides stays absent so a later source can still answer.
 */
export function mergeAliases(
  existing: readonly string[] | undefined,
  incoming: readonly string[] | undefined
): string[] | undefined {
  if (!existing && !incoming) return undefined

  const byKey = new Map<string, string>()
  for (const value of [...(existing ?? []), ...(incoming ?? [])]) {
    const name = value.trim()
    if (!name) continue

    const key = normalizeKeyText(name)
    if (!byKey.has(key)) byKey.set(key, name)
  }

  return [...byKey.values()]
}

/**
 * Merge CoreCompanyMetadata fields (fill-in-the-blanks + array merge).
 */
export function mergeCompanyMetadataFields(
  existing: ScrapedCompanyMetadata,
  incoming: ScrapedCompanyMetadata
): ScrapedCompanyMetadata {
  const merged = mergeScalarFields(existing, incoming, [
    'identity',
    'externalSites',
    'tags',
    'logos'
  ])

  return {
    ...merged,
    identity: mergeScrapedIdentities(existing.identity, incoming.identity),
    externalSites: mergeExternalSites(existing.externalSites, incoming.externalSites),
    tags: mergeTagsArray(existing.tags, incoming.tags),
    logos: mergeImageUrls(existing.logos, incoming.logos)
  }
}

/**
 * Merge ScrapedCharacterPersonFact arrays using the specified strategy.
 */
export function mergeCharacterPersons(
  existing: ScrapedCharacterPersonFact[] | undefined,
  incoming: ScrapedCharacterPersonFact[] | undefined,
  options: RelationCollectionMergeOptions
): ScrapedCharacterPersonFact[] | undefined {
  if (!existing && !incoming) return undefined

  return applyEntityCollectionStrategy(
    existing,
    incoming ?? [],
    options,
    (person) =>
      buildScrapedEntityAliasKeys(person, {
        includeCompactFallbackKeys: true,
        type: person.role
      }),
    (existingPerson, incomingPerson) => ({
      ...mergePersonMetadataFields(existingPerson, incomingPerson),
      role: existingPerson.role,
      isSpoiler: !!existingPerson.isSpoiler || !!incomingPerson.isSpoiler,
      note: existingPerson.note || incomingPerson.note
    })
  )
}

/**
 * Merge CoreCharacterMetadata fields (fill-in-the-blanks + array merge + nested persons).
 */
export function mergeCharacterMetadataFields(
  existing: ScrapedCharacterMetadata,
  incoming: ScrapedCharacterMetadata,
  relationCollectionOptions: RelationCollectionMergeOptions
): ScrapedCharacterMetadata {
  const merged = mergeScalarFields(existing, incoming, [
    'identity',
    'aliases',
    'externalSites',
    'tags',
    'persons',
    'photos'
  ])

  return {
    ...merged,
    identity: mergeScrapedIdentities(existing.identity, incoming.identity),
    aliases: mergeAliases(existing.aliases, incoming.aliases),
    externalSites: mergeExternalSites(existing.externalSites, incoming.externalSites),
    tags: mergeTagsArray(existing.tags, incoming.tags),
    persons: mergeCharacterPersons(existing.persons, incoming.persons, relationCollectionOptions),
    photos: mergeImageUrls(existing.photos, incoming.photos)
  }
}
