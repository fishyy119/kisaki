<!--
  CollectionConvertToStaticDialog

  Confirmation dialog for converting a dynamic collection to static.
  Performs the conversion and materializes current results into link tables.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { Icon } from '@renderer/components/ui/icon'
import { useAsyncData } from '@renderer/composables'
import { notify } from '@renderer/core/notify'
import { db, queryEntityIds, insertCollectionLinks, COLLECTION_LINKS } from '@renderer/core/db'
import { collections, type DynamicCollectionConfig } from '@shared/db'
import { CONTENT_ENTITY_TYPES } from '@shared/common'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Collection')

interface Props {
  collectionId: string
  /** Optional total count to display in the description */
  totalCount?: number
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  converted: [collectionId: string]
}>()

const isConverting = ref(false)

const {
  data: collection,
  isLoading,
  refetch
} = useAsyncData(
  async () => {
    const data = await db.query.collections.findFirst({
      where: eq(collections.id, props.collectionId)
    })
    return data ?? null
  },
  {
    watch: [() => props.collectionId],
    enabled: () => open.value
  }
)

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) refetch()
  },
  { immediate: true }
)

const dynamicConfig = computed(() => collection.value?.dynamicConfig ?? null)

const canConvert = computed(() => {
  if (!collection.value) return false
  if (!collection.value.isDynamic) return false
  return !!dynamicConfig.value
})

async function materializeDynamicCollection(config: DynamicCollectionConfig) {
  const collectionId = props.collectionId

  for (const entityType of CONTENT_ENTITY_TYPES) {
    const link = COLLECTION_LINKS[entityType]

    // Clear existing links to avoid unique constraint issues.
    await db.delete(link.table).where(eq(link.collectionIdColumn, collectionId))

    const entityConfig = config[entityType]
    if (!entityConfig.enabled) continue

    // Materialization snapshots the full result set regardless of the
    // current NSFW visibility preference.
    const entityIds = await queryEntityIds(entityType, {
      filter: entityConfig.filter,
      sortField: entityConfig.sortField,
      sortDirection: entityConfig.sortDirection,
      includeNsfw: true
    })

    await insertCollectionLinks(
      entityType,
      entityIds.map((entityId, index) => ({
        id: nanoid(),
        collectionId,
        entityId,
        note: null,
        orderInCollection: index
      }))
    )
  }
}

async function handleConfirm() {
  if (isConverting.value) return
  if (!canConvert.value || !dynamicConfig.value) return

  isConverting.value = true
  try {
    await materializeDynamicCollection(dynamicConfig.value)

    await db
      .update(collections)
      .set({ isDynamic: false, dynamicConfig: null })
      .where(eq(collections.id, props.collectionId))

    notify.success(m.value.library.forms.convertedToStatic)
    emit('converted', props.collectionId)
    open.value = false
  } catch (error) {
    log.error('Failed to convert to static:', error)
    notify.error(m.value.library.forms.convertFailed)
  } finally {
    isConverting.value = false
  }
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ m.library.forms.convertToStaticTitle }}</AlertDialogTitle>
      </AlertDialogHeader>
      <AlertDialogDescription>
        <template v-if="props.totalCount !== undefined">
          {{ m.library.forms.convertToStaticDescriptionWithCount({ count: props.totalCount }) }}
        </template>
        <template v-else>
          {{ m.library.forms.convertToStaticDescription }}
        </template>
      </AlertDialogDescription>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="isConverting">{{ m.common.cancel }}</AlertDialogCancel>
        <AlertDialogAction
          :disabled="isConverting || isLoading || !canConvert"
          @click="handleConfirm"
        >
          <template v-if="isConverting">
            <Icon
              icon="icon-[mdi--loading]"
              class="size-4 animate-spin mr-1.5"
            />
            {{ m.library.forms.converting }}
          </template>
          <template v-else>{{ m.library.forms.confirmConvert }}</template>
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
