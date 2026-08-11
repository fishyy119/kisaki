<!--
  CollectionDetailContent

  Content area for collection detail views (page and dialog).
  Uses CollectionProvider context for data.
  Cards have built-in lazy loading.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { VirtualGrid } from '@renderer/components/ui/virtual'
import { EntityCard } from '@renderer/components/shared'
import { StateView } from '@renderer/components/ui/state-view'
import { useCollection, useRenderState } from '@renderer/composables'
import type { ContentEntityData } from '@renderer/composables'
import { getEntityIcon } from '@renderer/utils/format'
import type { ContentEntityType } from '@shared/common'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

interface Props {
  scrollParent?: HTMLElement | null
}

const props = withDefaults(defineProps<Props>(), {
  scrollParent: null
})

const { collection, entities, entityType, isLoading, error } = useCollection()
const state = useRenderState(isLoading, error, collection)

const entityLabel = computed(() => m.value.library.entities[entityType.value])

const emit = defineEmits<{
  (
    e: 'entity-click',
    payload: { type: ContentEntityType; id: string; entity: ContentEntityData }
  ): void
}>()

function handleItemClick(entity: ContentEntityData) {
  if (state.value !== 'success') return
  emit('entity-click', { type: entityType.value, id: entity.id, entity })
}
</script>

<template>
  <!-- Loading / Error / Not Found -->
  <StateView
    v-if="state === 'loading' || state === 'error' || state === 'not-found'"
    :state="state"
    :error="error"
    :icon="getEntityIcon('collection')"
    :title="m.library.detail.notFoundTitle({ label: m.library.entities.collection })"
    :description="m.library.detail.notFoundDescription({ label: m.library.entities.collection })"
    class="h-full"
  />

  <!-- Empty state -->
  <StateView
    v-else-if="state === 'success' && entities.length === 0"
    state="empty"
    :icon="getEntityIcon(entityType)"
    :title="m.library.detail.collectionEmptyTitle({ label: entityLabel })"
    :description="m.library.detail.collectionEmptyDescription({ label: entityLabel })"
    class="h-full"
  />

  <!-- Content -->
  <VirtualGrid
    v-else-if="state === 'success'"
    :items="entities"
    :get-key="(item) => item.id"
    :scroll-parent="props.scrollParent"
    class="grid grid-cols-[repeat(auto-fill,8rem)] gap-3 justify-between"
  >
    <template #item="{ item }">
      <EntityCard
        :entity-type="entityType"
        :entity="item"
        class="w-full"
        @click="handleItemClick(item)"
      />
    </template>
  </VirtualGrid>
</template>
