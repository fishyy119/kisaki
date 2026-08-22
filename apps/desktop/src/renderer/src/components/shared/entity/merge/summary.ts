/**
 * Merge candidate summaries.
 *
 * A merge dialog shows the two rows side by side, so each card needs the one
 * secondary line that tells otherwise same-named rows apart. That line is merge
 * vocabulary and lives here; imagery comes from the shared entity image facts.
 */

import type { AllEntityType } from '@shared/common'
import { queryEntityRow, type EntityRowMap } from '@renderer/core/db'
import { messages } from '@renderer/core/i18n'
import { getEntityImageUrl } from '@renderer/utils/entity-image'
import type { EntityMergeSummary } from './types'

const SUB_TEXTS: { [T in AllEntityType]: (row: EntityRowMap[T]) => string } = {
  game: (row) => row.originalName || row.name,
  anime: (row) => row.originalName || row.name,
  character: (row) => row.originalName || row.name,
  person: (row) => row.originalName || row.name,
  company: (row) => row.originalName || row.name,
  collection: (row) =>
    row.isDynamic ? messages.value.merge.dynamicCollection : messages.value.merge.staticCollection,
  tag: (row) => row.description || row.name
}

export async function fetchEntityMergeSummary<T extends AllEntityType>(
  entityType: T,
  id: string
): Promise<EntityMergeSummary | null> {
  const row = await queryEntityRow(entityType, id)
  if (!row) return null

  return {
    entityType,
    id: row.id,
    name: row.name,
    subText: SUB_TEXTS[entityType](row),
    imageUrl: getEntityImageUrl(entityType, row, 'cover', { width: 96, height: 96 })
  }
}
