<!--
  RankingListRows
  Row renderer shared by the inline ranking list and its full-list dialog.
  Each row: rank, optional cover/icon, name over a share bar, and value with
  share-of-total on the right. Bar and share are relative to the full
  dataset (maxValue/totalValue), so a sliced inline view stays truthful.
-->
<script setup lang="ts">
import { Icon } from '@renderer/components/ui/icon'
import type { RankingListItem } from './types'

const props = withDefaults(
  defineProps<{
    items: RankingListItem[]
    /** Largest value in the full dataset (bar scale) */
    maxValue: number
    /** Share denominator (period total supplied by the list owner) */
    totalValue: number
    /** Rank of the first row minus one (for column-split inline views) */
    rankOffset?: number
  }>(),
  { rankOffset: 0 }
)

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
  <ol class="divide-y divide-border/60">
    <li
      v-for="(item, index) in props.items"
      :key="item.id"
      class="flex items-center gap-3 py-2"
    >
      <span class="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {{ props.rankOffset + index + 1 }}
      </span>

      <img
        v-if="item.coverUrl"
        :src="item.coverUrl"
        alt=""
        loading="lazy"
        class="size-8 shrink-0 rounded-md border border-border/40 object-cover"
      />
      <div
        v-else-if="item.icon"
        class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted"
      >
        <Icon
          :icon="item.icon"
          class="size-4 text-muted-foreground"
        />
      </div>

      <div class="min-w-0 flex-1">
        <div class="truncate text-sm">{{ item.name }}</div>
        <div class="mt-1 h-1 rounded-full bg-muted">
          <div
            class="h-full rounded-full bg-chart/70"
            :style="{ width: barWidth(item.value) }"
          />
        </div>
      </div>

      <div class="shrink-0 text-right">
        <div class="text-sm tabular-nums">{{ item.valueText }}</div>
        <div class="text-xs tabular-nums text-muted-foreground">{{ shareText(item.value) }}</div>
      </div>
    </li>
  </ol>
</template>
