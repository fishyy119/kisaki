import type { AllEntityType } from '@shared/common'
import type { EntityDeleteResult } from '@shared/entity-delete'
import { messages } from '@renderer/core/i18n'

const ENTITY_DELETE_ORDER: readonly AllEntityType[] = [
  'game',
  'character',
  'person',
  'company',
  'tag',
  'collection'
]

/**
 * Get the localized count phrase (for example "3 games") for deleted entities.
 */
export function formatEntityDeleteCount(entityType: AllEntityType, count: number): string {
  return messages.value.library.counts[entityType]({ count })
}

/**
 * Format a compact delete success message from grouped delete counts.
 */
export function formatEntityDeleteSuccessMessage(result: EntityDeleteResult): string {
  const items = ENTITY_DELETE_ORDER.flatMap((entityType) => {
    const count = result.deletedCounts[entityType]
    if (!count) return []
    return formatEntityDeleteCount(entityType, count)
  })

  return messages.value.library.feedback.deletedSummary({ items })
}
