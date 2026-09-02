import type { AllEntityType } from '@shared/entity-types'
import type { ExternalSite } from '@shared/db/contracts/json'
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
      patch.totalDuration = toDuration(target.totalDuration) + toDuration(source.totalDuration)
      applyFirst(patch, target, source, 'savePath')
      applyFirst(patch, target, source, 'launcherPath')
      applyFirst(patch, target, source, 'monitorPath')
      applyFirst(patch, target, source, 'dirPath')
      break
    case 'anime':
      applyFirst(patch, target, source, 'releaseDate')
      patch.lastActiveAt = latestDateValue(target.lastActiveAt, source.lastActiveAt)
      patch.totalDuration = toDuration(target.totalDuration) + toDuration(source.totalDuration)
      applyFirst(patch, target, source, 'totalEpisodes')
      applyFirst(patch, target, source, 'dirPath')
      break
    case 'comic':
      applyFirst(patch, target, source, 'releaseDate')
      patch.lastActiveAt = latestDateValue(target.lastActiveAt, source.lastActiveAt)
      patch.totalDuration = toDuration(target.totalDuration) + toDuration(source.totalDuration)
      applyFirst(patch, target, source, 'totalVolumes')
      applyFirst(patch, target, source, 'totalChapters')
      applyFirst(patch, target, source, 'readingDirection')
      applyFirst(patch, target, source, 'dirPath')
      break
    case 'novel':
      applyFirst(patch, target, source, 'releaseDate')
      patch.lastActiveAt = latestDateValue(target.lastActiveAt, source.lastActiveAt)
      patch.totalDuration = toDuration(target.totalDuration) + toDuration(source.totalDuration)
      applyFirst(patch, target, source, 'totalVolumes')
      applyFirst(patch, target, source, 'dirPath')
      break
    case 'person':
      patch.aliases = mergeAliases(target, source)
      applyFirst(patch, target, source, 'birthDate')
      applyFirst(patch, target, source, 'deathDate')
      applyFirst(patch, target, source, 'gender')
      break
    case 'company':
      applyFirst(patch, target, source, 'foundedDate')
      break
    case 'character':
      patch.aliases = mergeAliases(target, source)
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
    default:
      entityType satisfies never
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
    patch.externalSites = mergeExternalSites(target.externalSites, source.externalSites)
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

/**
 * Union both rows' aliases and absorb the names the source row is losing.
 *
 * A merge is the moment two records of one person or character become one, and
 * the source's own name is often the very alias worth keeping — pen names and
 * adult-work credits arrive from sources as separate entities.
 */
function mergeAliases(target: MergeRow, source: MergeRow): string[] {
  const merged: string[] = []
  const seen = new Set<string>()

  const candidates = [
    ...toStringArray(target.aliases),
    ...toStringArray(source.aliases),
    source.name,
    source.originalName
  ]

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const name = candidate.trim()
    if (!name) continue

    const key = normalizeKeyText(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(name)
  }

  // The surviving row's own names are not aliases of itself.
  const ownKeys = new Set(
    [target.name, target.originalName]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => normalizeKeyText(value.trim()))
  )

  return merged.filter((name) => !ownKeys.has(normalizeKeyText(name)))
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : []
}

// Rows arrive through the column's lenient read parser, so the array shape is
// trusted; only presence needs checking.
function mergeExternalSites(targetSites: unknown, sourceSites: unknown): ExternalSite[] {
  const merged: ExternalSite[] = []
  const seen = new Set<string>()

  for (const site of [...toExternalSites(targetSites), ...toExternalSites(sourceSites)]) {
    if (!site?.url) continue
    const key = normalizeKeyText(site.url)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(site)
  }

  return merged
}

function toExternalSites(value: unknown): ExternalSite[] {
  return Array.isArray(value) ? (value as ExternalSite[]) : []
}

function toDuration(value: unknown): number {
  return typeof value === 'number' ? value : 0
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
