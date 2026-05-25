import type { AllEntityType } from '@shared/common'
import type { RelatedSite } from '@shared/db/json-types'
import { normalizeKeyText } from '@shared/identity'
import type { MergeRow } from './types'

export function buildEntityFieldPatch(
  entityType: AllEntityType,
  target: MergeRow,
  source: MergeRow,
  attachmentPatch: MergeRow,
  now: Date
): MergeRow {
  const patch: MergeRow = {
    updatedAt: now
  }

  applyCommonFields(entityType, patch, target, source)

  switch (entityType) {
    case 'game':
      applyFirst(patch, target, source, 'releaseDate')
      patch.lastActiveAt = latestDateValue(target.lastActiveAt, source.lastActiveAt)
      patch.totalDuration = (target.totalDuration ?? 0) + (source.totalDuration ?? 0)
      applyFirst(patch, target, source, 'savePath')
      applyFirst(patch, target, source, 'launcherPath')
      applyFirst(patch, target, source, 'monitorPath')
      applyFirst(patch, target, source, 'gameDirPath')
      break
    case 'person':
      applyFirst(patch, target, source, 'birthDate')
      applyFirst(patch, target, source, 'deathDate')
      applyFirst(patch, target, source, 'gender')
      break
    case 'company':
      applyFirst(patch, target, source, 'foundedDate')
      break
    case 'character':
      for (const field of [
        'birthDate',
        'gender',
        'bloodType',
        'height',
        'weight',
        'bust',
        'waist',
        'hips',
        'cup',
        'age'
      ]) {
        applyFirst(patch, target, source, field)
      }
      break
    case 'collection':
      applyFirst(patch, target, source, 'description')
      patch.isNsfw = Boolean(target.isNsfw || source.isNsfw)
      break
    case 'tag':
      applyFirst(patch, target, source, 'description')
      patch.isNsfw = Boolean(target.isNsfw || source.isNsfw)
      break
  }

  Object.assign(patch, attachmentPatch)
  return pruneUnchangedPatch(target, patch)
}

function applyCommonFields(
  entityType: AllEntityType,
  patch: MergeRow,
  target: MergeRow,
  source: MergeRow
): void {
  if (entityType !== 'collection' && entityType !== 'tag') {
    applyFirst(patch, target, source, 'originalName')
    applyFirst(patch, target, source, 'sortName')
    applyFirst(patch, target, source, 'description')
    applyFirst(patch, target, source, 'score')
    patch.isFavorite = Boolean(target.isFavorite || source.isFavorite)
    patch.isNsfw = Boolean(target.isNsfw || source.isNsfw)
    patch.relatedSites = mergeRelatedSites(target.relatedSites, source.relatedSites)
  }

  patch.createdAt = earliestDateValue(target.createdAt, source.createdAt)
}

export function shouldUseSourceValue(targetValue: unknown, sourceValue: unknown): boolean {
  return !hasValue(targetValue) && hasValue(sourceValue)
}

function applyFirst(patch: MergeRow, target: MergeRow, source: MergeRow, field: string): void {
  if (shouldUseSourceValue(target[field], source[field])) {
    patch[field] = source[field]
  }
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function mergeRelatedSites(
  targetSites: RelatedSite[] | null | undefined,
  sourceSites: RelatedSite[] | null | undefined
): RelatedSite[] {
  const merged: RelatedSite[] = []
  const seen = new Set<string>()

  for (const site of [...(targetSites ?? []), ...(sourceSites ?? [])]) {
    if (!site?.url) continue
    const key = normalizeKeyText(site.url)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(site)
  }

  return merged
}

function earliestDateValue(a: unknown, b: unknown): unknown {
  const aTime = toTime(a)
  const bTime = toTime(b)
  if (aTime === null) return b
  if (bTime === null) return a
  return aTime <= bTime ? a : b
}

function latestDateValue(a: unknown, b: unknown): unknown {
  const aTime = toTime(a)
  const bTime = toTime(b)
  if (aTime === null) return b
  if (bTime === null) return a
  return aTime >= bTime ? a : b
}

function toTime(value: unknown): number | null {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  return null
}

function pruneUnchangedPatch(target: MergeRow, patch: MergeRow): MergeRow {
  const pruned: MergeRow = {}
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'updatedAt' || !areValuesEqual(target[key], value)) {
      pruned[key] = value
    }
  }
  return pruned
}

function areValuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  return JSON.stringify(a) === JSON.stringify(b)
}
