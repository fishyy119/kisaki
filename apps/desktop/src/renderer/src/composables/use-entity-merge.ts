import { ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { AllEntityType } from '@shared/entity-types'
import type { EntityMergeResult } from '@shared/entity-merge'
import { mergeEntities } from '@renderer/core/db'

interface UseEntityMergeOptions {
  entityType: MaybeRefOrGetter<AllEntityType>
  targetId: MaybeRefOrGetter<string>
  sourceId: MaybeRefOrGetter<string>
}

export function useEntityMerge(options: UseEntityMergeOptions) {
  const submitting = ref(false)

  async function mergeSelectedEntities(): Promise<EntityMergeResult> {
    if (submitting.value) {
      throw new Error('Entity merge is already running.')
    }

    submitting.value = true
    try {
      return await mergeEntities({
        entityType: toValue(options.entityType),
        targetId: toValue(options.targetId),
        sourceId: toValue(options.sourceId)
      })
    } finally {
      submitting.value = false
    }
  }

  return {
    submitting,
    mergeEntities: mergeSelectedEntities
  }
}
