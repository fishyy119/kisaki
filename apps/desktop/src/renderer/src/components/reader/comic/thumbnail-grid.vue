<!--
Page grid of the open unit, for finding a page by looking at it.
Boundary: rows are virtualized, so a preview is only requested while its row is
on screen.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { VirtualGrid } from '@renderer/components/ui/virtual'
import { useI18n } from '@renderer/composables/use-i18n'
import type { PageSource } from '@renderer/core/reader/page-source'
import PageThumbnail from './page-thumbnail.vue'

const props = defineProps<{
  source: PageSource | null
  currentPage: number
}>()

const emit = defineEmits<{
  select: [index: number]
}>()

const { m } = useI18n()

const scrollHost = ref<HTMLElement | null>(null)

const pages = computed<number[]>(() => {
  const total = props.source?.pageCount ?? null
  if (total === null) return []
  return Array.from({ length: total }, (_, index) => index)
})
</script>

<template>
  <div
    ref="scrollHost"
    class="h-full overflow-y-auto p-2"
  >
    <p
      v-if="pages.length === 0"
      class="px-2 py-1 text-xs text-muted-foreground"
    >
      {{ m.reader.panel.noPages }}
    </p>
    <VirtualGrid
      v-else-if="props.source"
      :items="pages"
      :scroll-parent="scrollHost"
      class="grid grid-cols-3 gap-2"
    >
      <template #item="{ item }">
        <PageThumbnail
          :source="props.source"
          :index="item"
          :active="item === props.currentPage"
          @select="(index) => emit('select', index)"
        />
      </template>
    </VirtualGrid>
  </div>
</template>
