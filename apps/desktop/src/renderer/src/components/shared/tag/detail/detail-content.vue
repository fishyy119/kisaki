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

interface Props {
  scrollParent?: HTMLElement | null
}

const props = withDefaults(defineProps<Props>(), {
  scrollParent: null
})

type EntityData = Game | Character | Person | Company

const ENTITY_LABELS: Record<ContentEntityType, string> = {
  game: '游戏',
  character: '角色',
  person: '人物',
  company: '公司'
}

const { tag, entities, entityType, isLoading, error } = useTag()
const state = useRenderState(isLoading, error, tag)

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
    icon="icon-[mdi--tag-off-outline]"
    title="标签不存在"
    description="该标签可能已被删除"
    class="h-full"
  />

  <!-- Empty state -->
  <StateView
    v-else-if="state === 'success' && entities.length === 0"
    state="empty"
    :icon="getEntityIcon('tag')"
    :title="`此标签暂无${entityLabel}`"
    :description="`尚无${entityLabel}使用此标签`"
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
