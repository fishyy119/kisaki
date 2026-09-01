<!--
  RankingListRow
  One ranked row: rank, optional cover/icon, name over a share bar, and value
  with share-of-total on the right. Bar and share are relative to the full
  dataset (maxValue/totalValue), so a sliced or virtualized view stays
  truthful. Rows carrying a `to` render as router links.
-->
<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Icon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/utils/cn'
import type { RankingListItem } from './types'

const props = defineProps<{
  item: RankingListItem
  /** 1-based rank in the full dataset */
  rank: number
  /** Largest value in the full dataset (bar scale) */
  maxValue: number
  /** Share denominator (period total supplied by the list owner) */
  totalValue: number
}>()

const emit = defineEmits<{
  /** Emitted when a linked row is clicked (before navigation lands) */
  navigate: []
}>()

function barWidth(value: number): string {
  if (props.maxValue <= 0) return '0%'
  return `${((value / props.maxValue) * 100).toFixed(1)}%`
}

function shareText(value: number): string {
  if (props.totalValue <= 0) return '0%'
  return `${((value / props.totalValue) * 100).toFixed(1)}%`
}
</script>

<template>
  <component
    :is="props.item.to ? RouterLink : 'div'"
    v-bind="props.item.to ? { to: props.item.to } : {}"
    :class="
      cn(
        'flex items-center gap-3 py-2',
        props.item.to && '-mx-2 rounded-md px-2 transition-colors hover:bg-accent/50'
      )
    "
    @click="props.item.to && emit('navigate')"
  >
    <span class="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
      {{ props.rank }}
    </span>

    <img
      v-if="props.item.coverUrl"
      :src="props.item.coverUrl"
      alt=""
      loading="lazy"
      class="size-8 shrink-0 rounded-md border border-border/40 object-cover"
    />
    <div
      v-else-if="props.item.icon"
      class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted"
    >
      <Icon
        :icon="props.item.icon"
        class="size-4 text-muted-foreground"
      />
    </div>

    <div class="min-w-0 flex-1">
      <div class="truncate text-sm">{{ props.item.name }}</div>
      <div class="mt-1 h-1 rounded-full bg-muted">
        <div
          class="h-full rounded-full bg-chart/70"
          :style="{ width: barWidth(props.item.value) }"
        />
      </div>
    </div>

    <div class="shrink-0 text-right">
      <div class="text-sm tabular-nums">{{ props.item.valueText }}</div>
      <div class="text-xs tabular-nums text-muted-foreground">
        {{ shareText(props.item.value) }}
      </div>
    </div>
  </component>
</template>
