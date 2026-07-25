<!--
  TagDetailContent
  Content area for tag detail views (dialog).
  Uses useTag() composable for data.
  Shows entities that have this tag attached.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useTag, useRenderState } from '@renderer/composables'
import { getEntityIcon } from '@renderer/utils/format'
import { StateView } from '@renderer/components/ui/state-view'
import { VirtualGrid } from '@renderer/components/ui/virtual'
import { EntityCard } from '@renderer/components/shared'
import type { ContentEntityType } from '@shared/common'
import type { Game, Character, Person, Company } from '@shared/db'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

interface Props {
  scrollParent?: HTMLElement | null
}

const props = withDefaults(defineProps<Props>(), {
  scrollParent: null
})

type EntityData = Game | Character | Person | Company

const { tag, entities, entityType, isLoading, error } = useTag()
const state = useRenderState(isLoading, error, tag)

const entityLabel = computed(() => m.value.library.entities[entityType.value])

const emit = defineEmits<{
  (e: 'entity-click', payload: { type: ContentEntityType; id: string; entity: EntityData }): void
}>()

function handleItemClick(entity: EntityData) {
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
    icon="icon-[mdi--tag-off-outline]"
    :title="m.library.detail.notFoundTitle({ label: m.library.entities.tag })"
    :description="m.library.detail.notFoundDescription({ label: m.library.entities.tag })"
    class="h-full"
  />

  <!-- Empty state -->
  <StateView
    v-else-if="state === 'success' && entities.length === 0"
    state="empty"
    :icon="getEntityIcon('tag')"
    :title="m.library.detail.tagEmptyTitle({ label: entityLabel })"
    :description="m.library.detail.tagEmptyDescription({ label: entityLabel })"
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
