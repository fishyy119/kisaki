import type { AllEntityType } from '@shared/common'
import type { EntityDeleteResult } from '@shared/entity-delete'

const ENTITY_DELETE_ORDER: readonly AllEntityType[] = [
  'game',
  'character',
  'person',
  'company',
  'tag',
  'collection'
]

export const ENTITY_DELETE_LABELS: Record<AllEntityType, string> = {
  game: '游戏',
  character: '角色',
  person: '人物',
  company: '公司',
  tag: '标签',
  collection: '合集'
}

/**
 * Get the localized label for an entity type.
 */
export function getEntityDeleteLabel(entityType: AllEntityType): string {
  return ENTITY_DELETE_LABELS[entityType]
}

/**
 * Format a compact delete success message from grouped delete counts.
 */
export function formatEntityDeleteSuccessMessage(result: EntityDeleteResult): string {
  const parts = ENTITY_DELETE_ORDER.flatMap((entityType) => {
    const count = result.deletedCounts[entityType]
    if (!count) return []
    return `${count} 个${getEntityDeleteLabel(entityType)}`
  })

  if (parts.length === 0) {
    return '已删除'
  }

  return `已删除 ${parts.join('、')}`
}
