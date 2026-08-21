import type { ExternalSite } from '@shared/db'
import {
  buildEntityCanonicalIdentityKey,
  buildEntityExternalIdKeys,
  buildEntityFallbackIdentityKeys,
  normalizeExternalIds,
  normalizeKeyText,
  type ExternalId
} from '@shared/identity'
import type {
  CoreAnimeMetadata,
  CoreCharacterMetadata,
  CoreCompanyMetadata,
  CoreGameMetadata,
  CorePersonMetadata,
  Tag
} from '@shared/metadata'
import type {
  IdentityAliasIndex,
  IngestCharacterNode,
  IngestCompanyNode,
  IngestPersonNode
} from './types'

interface IdentityMatchEntity {
  name: string
  originalName?: string
  externalIds?: ExternalId[] | null
}

export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Create alias indexes used to merge ingest graph nodes by external IDs and fallback names.
 */
export function createIdentityAliasIndex(): IdentityAliasIndex {
  return {
    externalIdToCanonical: new Map<string, string>(),
    fallbackToCanonical: new Map<string, Set<string>>()
  }
}

export function normalizeOptionalString(value: string | undefined | null): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    const normalized = normalizeOptionalString(value)
    if (normalized) return normalized
  }
  return undefined
}

function toExternalSiteKey(url: string): string {
  return normalizeKeyText(url)
}

export function mergeExternalIds(
  existing: ExternalId[] | undefined,
  incoming: ExternalId[] | undefined
): ExternalId[] {
  return normalizeExternalIds([...(existing ?? []), ...(incoming ?? [])])
}

function normalizeExternalSite(site: ExternalSite): ExternalSite | null {
  const label = normalizeOptionalString(site.label)
  const url = normalizeOptionalString(site.url)
  if (!url) return null
  return { label: label ?? url, url }
}

export function mergeExternalSites(
  existing: ExternalSite[] | undefined,
  incoming: ExternalSite[] | undefined
): ExternalSite[] {
  const merged = [...(existing ?? []), ...(incoming ?? [])]
  const byKey = new Map<string, ExternalSite>()

  for (const site of merged) {
    const normalized = normalizeExternalSite(site)
    if (!normalized) continue

    const key = toExternalSiteKey(normalized.url)
    const current = byKey.get(key)
    if (!current) {
      byKey.set(key, normalized)
      continue
    }

    byKey.set(key, {
      label: firstNonEmpty(current.label, normalized.label) ?? current.label,
      url: current.url
    })
  }

  return [...byKey.values()]
}

/**
 * Trims alias names and drops duplicates, keeping the first spelling of each.
 *
 * Absent stays absent: an omitted list means the source could not answer, while
 * an empty one means it says there are none.
 */
export function normalizeAliases(aliases: string[] | undefined): string[] | undefined {
  if (!aliases) return undefined

  const byKey = new Map<string, string>()
  for (const value of aliases) {
    const name = normalizeOptionalString(value)
    if (!name) continue

    const key = normalizeKeyText(name)
    if (!byKey.has(key)) byKey.set(key, name)
  }

  return [...byKey.values()]
}

export function mergeAliases(
  existing: string[] | undefined,
  incoming: string[] | undefined
): string[] | undefined {
  if (!existing && !incoming) return undefined
  return normalizeAliases([...(existing ?? []), ...(incoming ?? [])])
}

export function mergeTags(
  existing: Tag[] | undefined,
  incoming: Tag[] | undefined
): Tag[] | undefined {
  const merged = [...(existing ?? []), ...(incoming ?? [])]
  const byKey = new Map<string, Tag>()

  for (const tag of merged) {
    const name = normalizeOptionalString(tag.name)
    if (!name) continue

    const key = normalizeKeyText(name)
    const current = byKey.get(key)

    if (!current) {
      byKey.set(key, {
        name,
        isNsfw: tag.isNsfw ? true : undefined,
        isSpoiler: tag.isSpoiler ? true : undefined,
        note: normalizeOptionalString(tag.note)
      })
      continue
    }

    byKey.set(key, {
      name: current.name,
      isNsfw: current.isNsfw || tag.isNsfw ? true : undefined,
      isSpoiler: current.isSpoiler || tag.isSpoiler ? true : undefined,
      note: firstNonEmpty(current.note, tag.note)
    })
  }

  const values = [...byKey.values()]
  return values.length > 0 ? values : undefined
}

function toUrlKey(url: string): string {
  return normalizeKeyText(url)
}

export function mergeUrlCandidates(
  existing: string[] | undefined,
  incoming: string[] | undefined
): string[] | undefined {
  const merged = [...(existing ?? []), ...(incoming ?? [])]
  const byKey = new Map<string, string>()

  for (const url of merged) {
    const normalized = normalizeOptionalString(url)
    if (!normalized) continue
    byKey.set(toUrlKey(normalized), normalized)
  }

  const values = [...byKey.values()]
  return values.length > 0 ? values : undefined
}

export function pickFirstUrl(urls: string[] | undefined): string | undefined {
  return mergeUrlCandidates(undefined, urls)?.[0]
}

export function toSingleUrlArray(url: string | undefined): string[] | undefined {
  return url ? [url] : undefined
}

export function compareText(a: string, b: string): number {
  return a.localeCompare(b)
}

export function normalizeGameCore(raw: Partial<CoreGameMetadata>): CoreGameMetadata | null {
  const name = normalizeOptionalString(raw.name)
  if (!name) return null

  return {
    name,
    originalName: normalizeOptionalString(raw.originalName),
    releaseDate: raw.releaseDate,
    description: normalizeOptionalString(raw.description),
    externalSites: mergeExternalSites(undefined, raw.externalSites),
    externalIds: mergeExternalIds(undefined, raw.externalIds),
    tags: mergeTags(undefined, raw.tags)
  }
}

export function normalizeAnimeCore(raw: Partial<CoreAnimeMetadata>): CoreAnimeMetadata | null {
  const name = normalizeOptionalString(raw.name)
  if (!name) return null

  return {
    name,
    originalName: normalizeOptionalString(raw.originalName),
    releaseDate: raw.releaseDate,
    description: normalizeOptionalString(raw.description),
    format: raw.format,
    totalEpisodes: raw.totalEpisodes,
    externalSites: mergeExternalSites(undefined, raw.externalSites),
    externalIds: mergeExternalIds(undefined, raw.externalIds),
    tags: mergeTags(undefined, raw.tags)
  }
}

export function normalizePersonCore(raw: Partial<CorePersonMetadata>): CorePersonMetadata | null {
  const name = normalizeOptionalString(raw.name)
  if (!name) return null

  return {
    name,
    originalName: normalizeOptionalString(raw.originalName),
    aliases: normalizeAliases(raw.aliases),
    birthDate: raw.birthDate,
    deathDate: raw.deathDate,
    gender: raw.gender,
    description: normalizeOptionalString(raw.description),
    externalSites: mergeExternalSites(undefined, raw.externalSites),
    externalIds: mergeExternalIds(undefined, raw.externalIds),
    tags: mergeTags(undefined, raw.tags)
  }
}

export function normalizeCompanyCore(
  raw: Partial<CoreCompanyMetadata>
): CoreCompanyMetadata | null {
  const name = normalizeOptionalString(raw.name)
  if (!name) return null

  return {
    name,
    originalName: normalizeOptionalString(raw.originalName),
    foundedDate: raw.foundedDate,
    description: normalizeOptionalString(raw.description),
    externalSites: mergeExternalSites(undefined, raw.externalSites),
    externalIds: mergeExternalIds(undefined, raw.externalIds),
    tags: mergeTags(undefined, raw.tags)
  }
}

export function normalizeCharacterCore(
  raw: Partial<CoreCharacterMetadata>
): CoreCharacterMetadata | null {
  const name = normalizeOptionalString(raw.name)
  if (!name) return null

  return {
    name,
    originalName: normalizeOptionalString(raw.originalName),
    aliases: normalizeAliases(raw.aliases),
    birthDate: raw.birthDate,
    gender: raw.gender,
    age: raw.age,
    bloodType: raw.bloodType,
    height: raw.height,
    weight: raw.weight,
    bust: raw.bust,
    waist: raw.waist,
    hips: raw.hips,
    cup: raw.cup,
    description: normalizeOptionalString(raw.description),
    externalSites: mergeExternalSites(undefined, raw.externalSites),
    externalIds: mergeExternalIds(undefined, raw.externalIds),
    tags: mergeTags(undefined, raw.tags)
  }
}

function resolveCanonicalIdentityKey<T extends { core: IdentityMatchEntity }>(
  nodes: Map<string, T>,
  identityIndex: IdentityAliasIndex,
  entity: IdentityMatchEntity
): string | undefined {
  const externalIdKeys = buildEntityExternalIdKeys(entity)
  for (const key of externalIdKeys) {
    const canonicalKey = identityIndex.externalIdToCanonical.get(key)
    if (canonicalKey && nodes.has(canonicalKey)) {
      return canonicalKey
    }
  }

  const fallbackKeys = buildEntityFallbackIdentityKeys(entity)
  const fallbackCandidates = new Set<string>()

  for (const key of fallbackKeys) {
    for (const canonicalKey of identityIndex.fallbackToCanonical.get(key) ?? []) {
      if (nodes.has(canonicalKey)) {
        fallbackCandidates.add(canonicalKey)
      }
    }
  }

  if (externalIdKeys.length > 0) {
    const fallbackMatchesWithoutExternalIds = [...fallbackCandidates].filter((canonicalKey) => {
      const matchedNode = nodes.get(canonicalKey)
      return matchedNode && !matchedNode.core.externalIds?.length
    })

    return fallbackMatchesWithoutExternalIds.length === 1
      ? fallbackMatchesWithoutExternalIds[0]
      : undefined
  }

  return fallbackCandidates.size === 1 ? [...fallbackCandidates][0] : undefined
}

function registerIdentityAliases(
  identityIndex: IdentityAliasIndex,
  canonicalKey: string,
  entity: IdentityMatchEntity
): void {
  for (const key of buildEntityExternalIdKeys(entity)) {
    identityIndex.externalIdToCanonical.set(key, canonicalKey)
  }

  for (const key of buildEntityFallbackIdentityKeys(entity)) {
    const canonicalKeys = identityIndex.fallbackToCanonical.get(key) ?? new Set<string>()
    canonicalKeys.add(canonicalKey)
    identityIndex.fallbackToCanonical.set(key, canonicalKeys)
  }
}

function mergePersonCore(
  existing: CorePersonMetadata,
  incoming: CorePersonMetadata
): CorePersonMetadata {
  return {
    name: firstNonEmpty(existing.name, incoming.name) ?? existing.name,
    originalName: firstNonEmpty(existing.originalName, incoming.originalName),
    birthDate: existing.birthDate ?? incoming.birthDate,
    deathDate: existing.deathDate ?? incoming.deathDate,
    gender: existing.gender ?? incoming.gender,
    description: firstNonEmpty(existing.description, incoming.description),
    externalSites: mergeExternalSites(existing.externalSites, incoming.externalSites),
    externalIds: mergeExternalIds(existing.externalIds, incoming.externalIds),
    tags: mergeTags(existing.tags, incoming.tags)
  }
}

function mergeCompanyCore(
  existing: CoreCompanyMetadata,
  incoming: CoreCompanyMetadata
): CoreCompanyMetadata {
  return {
    name: firstNonEmpty(existing.name, incoming.name) ?? existing.name,
    originalName: firstNonEmpty(existing.originalName, incoming.originalName),
    foundedDate: existing.foundedDate ?? incoming.foundedDate,
    description: firstNonEmpty(existing.description, incoming.description),
    externalSites: mergeExternalSites(existing.externalSites, incoming.externalSites),
    externalIds: mergeExternalIds(existing.externalIds, incoming.externalIds),
    tags: mergeTags(existing.tags, incoming.tags)
  }
}

function mergeCharacterCore(
  existing: CoreCharacterMetadata,
  incoming: CoreCharacterMetadata
): CoreCharacterMetadata {
  return {
    name: firstNonEmpty(existing.name, incoming.name) ?? existing.name,
    originalName: firstNonEmpty(existing.originalName, incoming.originalName),
    birthDate: existing.birthDate ?? incoming.birthDate,
    gender: existing.gender ?? incoming.gender,
    age: existing.age ?? incoming.age,
    bloodType: existing.bloodType ?? incoming.bloodType,
    height: existing.height ?? incoming.height,
    weight: existing.weight ?? incoming.weight,
    bust: existing.bust ?? incoming.bust,
    waist: existing.waist ?? incoming.waist,
    hips: existing.hips ?? incoming.hips,
    cup: existing.cup ?? incoming.cup,
    description: firstNonEmpty(existing.description, incoming.description),
    externalSites: mergeExternalSites(existing.externalSites, incoming.externalSites),
    externalIds: mergeExternalIds(existing.externalIds, incoming.externalIds),
    tags: mergeTags(existing.tags, incoming.tags)
  }
}

export function upsertPersonNode(
  nodes: Map<string, IngestPersonNode>,
  identityIndex: IdentityAliasIndex,
  core: CorePersonMetadata,
  photoUrls: string[] | undefined
): string {
  const identityKey =
    resolveCanonicalIdentityKey(nodes, identityIndex, core) ?? buildEntityCanonicalIdentityKey(core)
  const existing = nodes.get(identityKey)

  if (!existing) {
    nodes.set(identityKey, {
      identityKey,
      core,
      photoUrls: mergeUrlCandidates(undefined, photoUrls)
    })
    registerIdentityAliases(identityIndex, identityKey, core)
    return identityKey
  }

  existing.core = mergePersonCore(existing.core, core)
  existing.photoUrls = mergeUrlCandidates(existing.photoUrls, photoUrls)
  registerIdentityAliases(identityIndex, existing.identityKey, existing.core)
  return identityKey
}

export function upsertCompanyNode(
  nodes: Map<string, IngestCompanyNode>,
  identityIndex: IdentityAliasIndex,
  core: CoreCompanyMetadata,
  logoUrls: string[] | undefined
): string {
  const identityKey =
    resolveCanonicalIdentityKey(nodes, identityIndex, core) ?? buildEntityCanonicalIdentityKey(core)
  const existing = nodes.get(identityKey)

  if (!existing) {
    nodes.set(identityKey, {
      identityKey,
      core,
      logoUrls: mergeUrlCandidates(undefined, logoUrls)
    })
    registerIdentityAliases(identityIndex, identityKey, core)
    return identityKey
  }

  existing.core = mergeCompanyCore(existing.core, core)
  existing.logoUrls = mergeUrlCandidates(existing.logoUrls, logoUrls)
  registerIdentityAliases(identityIndex, existing.identityKey, existing.core)
  return identityKey
}

export function upsertCharacterNode(
  nodes: Map<string, IngestCharacterNode>,
  identityIndex: IdentityAliasIndex,
  core: CoreCharacterMetadata,
  photoUrls: string[] | undefined
): string {
  const identityKey =
    resolveCanonicalIdentityKey(nodes, identityIndex, core) ?? buildEntityCanonicalIdentityKey(core)
  const existing = nodes.get(identityKey)

  if (!existing) {
    nodes.set(identityKey, {
      identityKey,
      core,
      photoUrls: mergeUrlCandidates(undefined, photoUrls)
    })
    registerIdentityAliases(identityIndex, identityKey, core)
    return identityKey
  }

  existing.core = mergeCharacterCore(existing.core, core)
  existing.photoUrls = mergeUrlCandidates(existing.photoUrls, photoUrls)
  registerIdentityAliases(identityIndex, existing.identityKey, existing.core)
  return identityKey
}
