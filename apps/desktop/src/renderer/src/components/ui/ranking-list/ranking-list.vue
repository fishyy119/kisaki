<!--
  RankingList
  Divider-based ranked row list for top-N entities (games, tags,
  collections). Replaces axis charts for ranking data: full names, exact
  values, share-of-total, and optional cover imagery per row. Shows up to
  maxItems rows inline with a "view all" dialog for the full dataset.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { cn } from '@renderer/utils/cn'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { VirtualList } from '@renderer/components/ui/virtual'
import RankingListRow from './ranking-list-row.vue'
import RankingListRows from './ranking-list-rows.vue'
import { useI18n } from '@renderer/composables/use-i18n'
import type { RankingListProps } from './types'

const props = withDefaults(defineProps<RankingListProps>(), {
  maxItems: 8,
  columns: 1
})

const { m } = useI18n()

const expandTitleText = computed(() => props.expandTitle ?? m.value.ui.rankingList.expandTitle)

const dialogOpen = ref(false)

const inlineItems = computed(() => props.items.slice(0, props.maxItems))
const maxValue = computed(() => props.items[0]?.value ?? 0)
const totalValue = computed(
  () => props.totalValue ?? props.items.reduce((sum, item) => sum + item.value, 0)
)

// Column split: reading order runs down the first column, then the second.
const inlineColumns = computed(() => {
  if (props.columns === 1 || inlineItems.value.length <= 1) {
    return [{ items: inlineItems.value, rankOffset: 0 }]
  }
  const split = Math.ceil(inlineItems.value.length / 2)
  return [
    { items: inlineItems.value.slice(0, split), rankOffset: 0 },
    { items: inlineItems.value.slice(split), rankOffset: split }
  ]
})
</script>

<template>
  <div
    :class="cn(props.class)"
    data-slot="ranking-list"
  >
    <div
      class="grid gap-x-8"
      :class="inlineColumns.length === 2 ? 'grid-cols-2' : 'grid-cols-1'"
    >
      <RankingListRows
        v-for="column in inlineColumns"
        :key="column.rankOffset"
        :items="column.items"
        :max-value="maxValue"
        :total-value="totalValue"
        :rank-offset="column.rankOffset"
      />
    </div>

    <Button
      v-if="props.items.length > inlineItems.length"
      variant="ghost"
      size="sm"
      class="mt-1 w-full text-muted-foreground"
      @click="dialogOpen = true"
    >
      {{ m.ui.rankingList.viewAll({ count: props.items.length }) }}
    </Button>

    <Dialog
      v-if="dialogOpen"
      v-model:open="dialogOpen"
    >
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ expandTitleText }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="max-h-[65vh] scrollbar-thin">
          <!-- The full dataset can carry thousands of rows, so they virtualize -->
          <VirtualList
            :items="props.items"
            :get-key="(item) => item.id"
            scroll="region"
            class="flex flex-col"
          >
            <template #item="{ item, index }">
              <!-- Bottom border on all but the last row keeps row heights uniform -->
              <div
                :class="index < props.items.length - 1 ? 'border-b border-border/60' : undefined"
              >
                <RankingListRow
                  :item="item"
                  :rank="index + 1"
                  :max-value="maxValue"
                  :total-value="totalValue"
                  @navigate="dialogOpen = false"
                />
              </div>
            </template>
          </VirtualList>
        </DialogBody>
      </DialogContent>
    </Dialog>
  </div>
</template>
