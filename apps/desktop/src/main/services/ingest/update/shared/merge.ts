/**
 * Collection merges resolve an authoritative incoming collection against the
 * stored one. `merge` only adds, so an empty incoming means "nothing to do";
 * `replace` makes the stored collection equal the incoming one, so an empty
 * incoming clears it. `undefined` means the plan carries no change.
 */

import type { ExternalSite } from '@shared/db'
import { normalizeExternalIds, normalizeKeyText, type ExternalId } from '@shared/identity'
import type { IngestUpdatePolicy } from '@shared/ingest/update'
import type { Tag } from '@shared/metadata'
import { normalizeExternalSites, normalizeTags } from './normalization'

export function mergeExternalIds(
  current: ExternalId[],
  incoming: ExternalId[],
  mode: IngestUpdatePolicy['collectionUpdate']
): ExternalId[] | undefined {
  if (mode === 'replace') return normalizeExternalIds(incoming)
  if (incoming.length === 0) return undefined
  return normalizeExternalIds([...current, ...incoming])
}

export function mergeExternalSites(
  current: ExternalSite[],
  incoming: ExternalSite[],
  mode: IngestUpdatePolicy['collectionUpdate']
): ExternalSite[] | undefined {
  const normalizedIncoming = normalizeExternalSites(incoming) ?? []
  if (mode === 'replace') return normalizedIncoming
  if (normalizedIncoming.length === 0) return undefined

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
  if (mode === 'replace') return normalizedIncoming
  if (normalizedIncoming.length === 0) return undefined

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

export function areExternalSitesEqual(current: ExternalSite[], next: ExternalSite[]): boolean {
  return areScalarValuesEqual(
    normalizeExternalSites(current) ?? [],
    normalizeExternalSites(next) ?? []
  )
}

export function areTagsEqual(current: Tag[], next: Tag[]): boolean {
  return areScalarValuesEqual(normalizeTags(current) ?? [], normalizeTags(next) ?? [])
}
