import type {
  LibraryAssetChange,
  LibraryCollectionDynamicConfigSnapshot,
  LibraryCoreChange,
  LibraryEntityChange,
  LibraryScoreChange
} from '@shared/events/library'
import type { EntityProjection } from '../types'
import {
  normalizeEntityValue,
  normalizeNullableString,
  nullableNumber
} from '../shared/normalization'
import { createPartialSnapshot } from '../shared/snapshot'

export function projectEntityChanges(
  projection: EntityProjection,
  firstOld: Record<string, unknown>,
  lastNext: Record<string, unknown>
): LibraryEntityChange[] {
  const projected: LibraryEntityChange[] = []

  if (projection.scoreField) {
    const before = nullableNumber(firstOld[projection.scoreField])
    const after = nullableNumber(lastNext[projection.scoreField])
    if (before !== after) {
      projected.push({
        facet: 'score',
        before: { score: before },
        after: { score: after },
        fields: ['score']
      } satisfies LibraryScoreChange)
    }
  }

  const core = createPartialSnapshot(
    firstOld,
    lastNext,
    projection.coreFields,
    normalizeEntityValue
  )
  if (core.fields.length > 0) {
    projected.push({
      facet: 'core',
      before: core.before,
      after: core.after,
      fields: core.fields
    } satisfies LibraryCoreChange<Record<string, unknown>>)
  }

  if (projection.assetFields) {
    const assets = createPartialSnapshot(
      firstOld,
      lastNext,
      projection.assetFields,
      normalizeNullableString
    )
    if (assets.fields.length > 0) {
      projected.push({
        facet: 'assets',
        before: assets.before,
        after: assets.after,
        fields: assets.fields
      } satisfies LibraryAssetChange<Record<string, unknown>>)
    }
  }

  if (projection.dynamicConfigFields) {
    const dynamicConfig = createPartialSnapshot<LibraryCollectionDynamicConfigSnapshot>(
      firstOld,
      lastNext,
      projection.dynamicConfigFields,
      normalizeEntityValue
    )
    if (dynamicConfig.fields.length > 0) {
      projected.push({
        facet: 'dynamicConfig',
        before: dynamicConfig.before,
        after: dynamicConfig.after,
        fields: dynamicConfig.fields
      })
    }
  }

  return projected
}
