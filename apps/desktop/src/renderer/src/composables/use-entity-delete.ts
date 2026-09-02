import {
  computed,
  ref,
  toRaw,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref
} from 'vue'
import type { AllEntityType } from '@shared/entity-types'
import type { EntityDeleteResult } from '@shared/entity-delete'
import { deleteEntities, previewEntityDelete } from '@renderer/core/db'
import { messages } from '@renderer/core/i18n'
import { useAsyncData } from './use-async-data'

interface UseEntityDeleteOptions {
  entityType: MaybeRefOrGetter<AllEntityType>
  entityIds: ComputedRef<string[]>
  open: Ref<boolean>
}

/**
 * Shared state and actions for entity delete dialogs.
 */
export function useEntityDelete(options: UseEntityDeleteOptions) {
  const selectedRelatedTypes = ref<AllEntityType[]>([])
  const entityIdsKey = computed(() => options.entityIds.value.join('\0'))

  const { data, isLoading } = useAsyncData(
    async () => {
      const entityIds = options.entityIds.value.filter(Boolean)
      if (entityIds.length === 0) {
        return {
          entityType: toValue(options.entityType),
          items: [],
          relatedOptions: []
        }
      }

      return await previewEntityDelete({
        entityType: toValue(options.entityType),
        entityIds
      })
    },
    {
      watch: [entityIdsKey],
      enabled: () => options.open.value
    }
  )

  watch(data, () => {
    selectedRelatedTypes.value = []
  })

  const items = computed(() => data.value?.items ?? [])
  const relatedOptions = computed(() => data.value?.relatedOptions ?? [])
  const resolvedEntityIds = computed(() => items.value.map((item) => item.id))
  const count = computed(() => items.value.length)
  const firstName = computed(() => items.value[0]?.name ?? '')
  const entityName = computed(() => {
    if (count.value <= 1) return firstName.value
    return firstName.value
      ? messages.value.library.feedback.nameAndMore({ name: firstName.value, count: count.value })
      : messages.value.values.itemCount({ count: count.value })
  })
  const previewNames = computed(() =>
    items.value
      .slice(0, 6)
      .map((item) => item.name)
      .filter(Boolean)
  )

  async function deleteSelectedEntities(): Promise<EntityDeleteResult> {
    return await deleteEntities({
      entityType: toValue(options.entityType),
      entityIds: resolvedEntityIds.value,
      deleteRelatedTypes: toRaw(selectedRelatedTypes.value)
    })
  }

  return {
    data,
    isLoading,
    items,
    relatedOptions,
    selectedRelatedTypes,
    resolvedEntityIds,
    count,
    firstName,
    entityName,
    previewNames,
    deleteSelectedEntities
  }
}
