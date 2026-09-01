<!--
  RankingListRows
  Row list for the inline (sliced) ranking view. Bar and share are relative
  to the full dataset (maxValue/totalValue), so a sliced inline view stays
  truthful. The full-list dialog virtualizes rows itself.
-->
<script setup lang="ts">
import RankingListRow from './ranking-list-row.vue'
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
</script>

<template>
  <ol class="divide-y divide-border/60">
    <li
      v-for="(item, index) in props.items"
      :key="item.id"
    >
      <RankingListRow
        :item="item"
        :rank="props.rankOffset + index + 1"
        :max-value="props.maxValue"
        :total-value="props.totalValue"
      />
    </li>
  </ol>
</template>
