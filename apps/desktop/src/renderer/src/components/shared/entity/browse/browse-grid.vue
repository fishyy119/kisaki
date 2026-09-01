<!--
  EntityBrowseGrid
  Virtualized card grid of one content entity type.
-->
<script setup lang="ts">
import { VirtualGrid } from '@renderer/components/ui/virtual'
import type { ContentEntityData } from '@renderer/composables/content-entities'
import type { ContentEntityType } from '@shared/common'
import EntityCard from '../card'

interface Props {
  entityType: ContentEntityType
  entities: ContentEntityData[]
  scrollParent?: HTMLElement | null
}

const props = withDefaults(defineProps<Props>(), {
  scrollParent: null
})

const emit = defineEmits<{
  open: [entityType: ContentEntityType, id: string]
}>()
</script>

<template>
  <VirtualGrid
    :items="props.entities"
    :get-key="(item) => item.id"
    :scroll-parent="props.scrollParent"
    class="grid grid-cols-[repeat(auto-fill,8rem)] justify-between gap-3"
  >
    <template #item="{ item }">
      <EntityCard
        :entity-type="props.entityType"
        :entity="item"
        size="md"
        class="w-full"
        @click="emit('open', props.entityType, item.id)"
      />
    </template>
  </VirtualGrid>
</template>
