import { and, eq } from 'drizzle-orm'
import type { DbContext } from '@main/services/db'
import {
  characterExternalIds,
  companyExternalIds,
  gameExternalIds,
  personExternalIds,
  tags
} from '@shared/db'
import type { RelatedSite } from '@shared/db'
import { normalizeExternalIds, normalizeKeyText, type ExternalId } from '@shared/identity'
import type { Tag } from '@shared/metadata'
import type { IngestUpdateLookup, IngestUpdatePolicy } from '@shared/ingest/update'
import type { UpdateResolvedSelection } from './types'

function uniqueByKey<T>(items: T[], keyBuilder: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []

  for (const item of items) {
    const key = keyBuilder(item)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }

  return result
}

export function normalizeOptionalString(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function normalizeUrlCandidates(urls: string[] | null | undefined): string[] | undefined {
  const normalized = uniqueByKey(
    (urls ?? [])
      .map((url) => normalizeOptionalString(url))
      .filter((url): url is string => typeof url === 'string'),
    (url) => normalizeKeyText(url)
  )

  return normalized.length > 0 ? normalized : undefined
}

export function pickFirstUrl(urls: string[] | null | undefined): string | undefined {
  return normalizeUrlCandidates(urls)?.[0]
}

export function normalizeRelatedSites(
  sites: RelatedSite[] | null | undefined
): RelatedSite[] | undefined {
  const normalized = uniqueByKey(
    (sites ?? [])
      .map((site) => {
        const url = normalizeOptionalString(site.url)
        if (!url) return null

        return {
          url,
          label: normalizeOptionalString(site.label) ?? url
        } satisfies RelatedSite
      })
      .filter((site): site is RelatedSite => site !== null),
    (site) => normalizeKeyText(site.url)
  )

  return normalized.length > 0 ? normalized : undefined
}

export function normalizeTags(tagsInput: Tag[] | null | undefined): Tag[] | undefined {
  const normalized = uniqueByKey(
    (tagsInput ?? [])
      .map((tag) => {
        const name = normalizeOptionalString(tag.name)
        if (!name) return null

        const normalizedTag: Tag = {
          name,
          isNsfw: tag.isNsfw ? true : undefined,
          isSpoiler: tag.isSpoiler ? true : undefined,
          note: normalizeOptionalString(tag.note)
        }

        return normalizedTag
      })
      .filter((tag): tag is Tag => tag !== null),
    (tag) => normalizeKeyText(tag.name)
  )

  return normalized.length > 0 ? normalized : undefined
}

export function normalizeSelection<T extends string>(
  selection: readonly T[] | null | undefined,
  allowed: readonly T[]
): T[] {
  const allowedSet = new Set(allowed)
  return [...new Set((selection ?? []).filter((item): item is T => allowedSet.has(item as T)))]
}

export function normalizePolicy(
  policy: Partial<IngestUpdatePolicy> | undefined
): IngestUpdatePolicy {
  return {
    singularUpdate: policy?.singularUpdate === 'overwrite' ? 'overwrite' : 'ifMissing',
    collectionUpdate: policy?.collectionUpdate === 'replace' ? 'replace' : 'merge'
  }
}

export function resolveUpdateSelection<
  TSurface extends string,
  TCoreSurface extends TSurface,
  TMediaSurface extends TSurface,
  TRelationSurface extends TSurface = never
>(params: {
  surfaces: readonly TSurface[]
  coreSurfaces: readonly TCoreSurface[]
  mediaSurfaces: readonly TMediaSurface[]
  relationSurfaces?: readonly TRelationSurface[]
}): UpdateResolvedSelection<TSurface, TCoreSurface, TMediaSurface, TRelationSurface> {
  const selected = new Set(params.surfaces)

  return {
    surfaces: [...params.surfaces],
    coreSurfaces: params.coreSurfaces.filter((surface) => selected.has(surface as TSurface)),
    mediaSurfaces: params.mediaSurfaces.filter((surface) => selected.has(surface as TSurface)),
    relationSurfaces: (params.relationSurfaces ?? []).filter((surface) =>
      selected.has(surface as TSurface)
    ) as TRelationSurface[]
  }
}

export function normalizeLookup(lookup: IngestUpdateLookup): {
  name: string
  knownIds: ExternalId[]
} {
  const name = normalizeOptionalString(lookup.name)
  if (!name) {
    throw new Error('Update lookup name is required')
  }

  return {
    name,
    knownIds: normalizeExternalIds(lookup.knownIds ?? [])
  }
}

export function isMissingValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}

export function shouldApplyScalarUpdate(
  currentValue: unknown,
  incomingValue: unknown,
  policy: IngestUpdatePolicy['singularUpdate']
): boolean {
  if (isMissingValue(incomingValue)) return false
  if (policy === 'overwrite') return true
  return isMissingValue(currentValue)
}

export function shouldApplyMediaUpdate(
  currentFile: string | null | undefined,
  incomingUrl: string | undefined,
  policy: IngestUpdatePolicy['singularUpdate']
): boolean {
  if (!incomingUrl) return false
  if (policy === 'overwrite') return true
  return !normalizeOptionalString(currentFile)
}

export function mergeExternalIds(
  current: ExternalId[],
  incoming: ExternalId[],
  mode: IngestUpdatePolicy['collectionUpdate']
): ExternalId[] | undefined {
  if (incoming.length === 0) return undefined
  if (mode === 'replace') return normalizeExternalIds(incoming)
  return normalizeExternalIds([...current, ...incoming])
}

export function mergeRelatedSites(
  current: RelatedSite[],
  incoming: RelatedSite[],
  mode: IngestUpdatePolicy['collectionUpdate']
): RelatedSite[] | undefined {
  const normalizedIncoming = normalizeRelatedSites(incoming) ?? []
  if (normalizedIncoming.length === 0) return undefined
  if (mode === 'replace') return normalizedIncoming

  const currentKeys = new Set(current.map((site) => normalizeKeyText(site.url)))
  const appended = normalizedIncoming.filter((site) => !currentKeys.has(normalizeKeyText(site.url)))
  return appended.length > 0 ? [...current, ...appended] : undefined
}

export function mergeTags(
  current: Tag[],
  incoming: Tag[],
  mode: IngestUpdatePolicy['collectionUpdate']
): Tag[] | undefined {
  const normalizedIncoming = normalizeTags(incoming) ?? []
  if (normalizedIncoming.length === 0) return undefined
  if (mode === 'replace') return normalizedIncoming

  const currentKeys = new Set(current.map((tag) => normalizeKeyText(tag.name)))
  const appended = normalizedIncoming.filter((tag) => !currentKeys.has(normalizeKeyText(tag.name)))
  return appended.length > 0 ? [...current, ...appended] : undefined
}

export function areScalarValuesEqual(currentValue: unknown, nextValue: unknown): boolean {
  return JSON.stringify(currentValue ?? null) === JSON.stringify(nextValue ?? null)
}

export function areExternalIdsEqual(current: ExternalId[], next: ExternalId[]): boolean {
  return areScalarValuesEqual(normalizeExternalIds(current), normalizeExternalIds(next))
}

export function areRelatedSitesEqual(current: RelatedSite[], next: RelatedSite[]): boolean {
  return areScalarValuesEqual(
    normalizeRelatedSites(current) ?? [],
    normalizeRelatedSites(next) ?? []
  )
}

export function areTagsEqual(current: Tag[], next: Tag[]): boolean {
  return areScalarValuesEqual(normalizeTags(current) ?? [], normalizeTags(next) ?? [])
}

export function ensurePersonExternalIdsAvailable(
  tx: DbContext,
  personId: string,
  externalIds: ExternalId[]
): void {
  for (const externalId of normalizeExternalIds(externalIds)) {
    const existing = tx
      .select()
      .from(personExternalIds)
      .where(
        and(
          eq(personExternalIds.source, externalId.source),
          eq(personExternalIds.externalId, externalId.id)
        )
      )
      .limit(1)
      .all()[0]

    if (existing && existing.personId !== personId) {
      throw new Error(
        `External ID already belongs to another person: ${externalId.source}:${externalId.id}`
      )
    }
  }
}

export function ensureCompanyExternalIdsAvailable(
  tx: DbContext,
  companyId: string,
  externalIds: ExternalId[]
): void {
  for (const externalId of normalizeExternalIds(externalIds)) {
    const existing = tx
      .select()
      .from(companyExternalIds)
      .where(
        and(
          eq(companyExternalIds.source, externalId.source),
          eq(companyExternalIds.externalId, externalId.id)
        )
      )
      .limit(1)
      .all()[0]

    if (existing && existing.companyId !== companyId) {
      throw new Error(
        `External ID already belongs to another company: ${externalId.source}:${externalId.id}`
      )
    }
  }
}

export function ensureCharacterExternalIdsAvailable(
  tx: DbContext,
  characterId: string,
  externalIds: ExternalId[]
): void {
  for (const externalId of normalizeExternalIds(externalIds)) {
    const existing = tx
      .select()
      .from(characterExternalIds)
      .where(
        and(
          eq(characterExternalIds.source, externalId.source),
          eq(characterExternalIds.externalId, externalId.id)
        )
      )
      .limit(1)
      .all()[0]

    if (existing && existing.characterId !== characterId) {
      throw new Error(
        `External ID already belongs to another character: ${externalId.source}:${externalId.id}`
      )
    }
  }
}

export function ensureGameExternalIdsAvailable(
  tx: DbContext,
  gameId: string,
  externalIds: ExternalId[]
): void {
  for (const externalId of normalizeExternalIds(externalIds)) {
    const existing = tx
      .select()
      .from(gameExternalIds)
      .where(
        and(
          eq(gameExternalIds.source, externalId.source),
          eq(gameExternalIds.externalId, externalId.id)
        )
      )
      .limit(1)
      .all()[0]

    if (existing && existing.gameId !== gameId) {
      throw new Error(
        `External ID already belongs to another game: ${externalId.source}:${externalId.id}`
      )
    }
  }
}

export function findExistingTagId(tx: DbContext, name: string): string | undefined {
  const normalizedName = normalizeKeyText(name)
  return tx
    .select()
    .from(tags)
    .all()
    .find((row) => normalizeKeyText(row.name) === normalizedName)?.id
}
