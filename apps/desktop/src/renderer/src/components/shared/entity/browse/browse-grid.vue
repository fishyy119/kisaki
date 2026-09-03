<!--
  EntityBrowseGrid
  Virtualized card grid of one content entity type, scrolling inside the
  enclosing ScrollRegion.
-->
<script setup lang="ts">
import { VirtualGrid } from '@renderer/components/ui/virtual'
import type { ContentEntityData } from '@renderer/composables/content-entities'
import type { ContentEntityType } from '@shared/entity-types'
import EntityCard from '../card'

interface Props {
  entityType: ContentEntityType
  entities: ContentEntityData[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  open: [entityType: ContentEntityType, id: string]
}>()
</script>

<template>
  <VirtualGrid
    :items="props.entities"
    :get-key="(item) => item.id"
    scroll-parent="region"
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
