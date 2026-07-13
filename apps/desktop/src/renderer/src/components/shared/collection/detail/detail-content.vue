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
import { getEntityIcon } from '@renderer/utils/format'
import type { ContentEntityType } from '@shared/common'
import type { Game, Character, Person, Company } from '@shared/db'

interface Props {
  scrollParent?: HTMLElement | null
}

const props = withDefaults(defineProps<Props>(), {
  scrollParent: null
})

type EntityData = Game | Character | Person | Company

const { collection, entities, entityType, isLoading, error } = useCollection()
const state = useRenderState(isLoading, error, collection)

const ENTITY_LABELS: Record<ContentEntityType, string> = {
  game: '游戏',
  character: '角色',
  person: '人物',
  company: '公司'
}

const entityLabel = computed(() => ENTITY_LABELS[entityType.value])

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
    :icon="getEntityIcon('collection')"
    title="合集不存在"
    description="该合集可能已被删除"
    class="h-full"
  />

  <!-- Empty state -->
  <StateView
    v-else-if="state === 'success' && entities.length === 0"
    state="empty"
    :icon="getEntityIcon(entityType)"
    :title="`此合集暂无${entityLabel}`"
    :description="`通过扫描器添加${entityLabel}到此合集`"
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
