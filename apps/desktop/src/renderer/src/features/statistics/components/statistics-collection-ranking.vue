<!--
  Statistics Collection Ranking

  Ranked collection list (share bars) by play time or session count. Owns
  its module header: Section title with the sort control inline. Shares are
  relative to the period total (a session counts under each collection that
  contains its game).
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStatistics } from '../composables'
import {
  computeCollectionRanking,
  sessionDurationMs,
  type RankingSort
} from '@renderer/utils/statistics'
import { RankingList, type RankingListItem } from '@renderer/components/ui/ranking-list'
import { Section } from '@renderer/components/ui/section'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { formatDuration } from '@renderer/utils/datetime'
import { getEntityIcon } from '@renderer/utils/format'
import type { GameSession } from '@shared/db'

interface Props {
  /** Module header title */
  title: string
  /** Override sessions (for custom data source) */
  sessions?: GameSession[]
}

const props = defineProps<Props>()

const context = useStatistics()

const effectiveSessions = computed(() => props.sessions ?? context.sessions.value)

// Local sort state (not persisted)
const sort = ref<RankingSort>('time')

// Share denominator: period total for the active metric
const totalValue = computed(() =>
  sort.value === 'time'
    ? effectiveSessions.value.reduce((sum, s) => sum + sessionDurationMs(s), 0)
    : effectiveSessions.value.length
)

const items = computed<RankingListItem[]>(() =>
  computeCollectionRanking(
    effectiveSessions.value,
    context.gameCollectionLinks.value,
    context.collections.value,
    sort.value
  ).map((item) => ({
    id: item.id,
    name: item.name,
    value: sort.value === 'time' ? item.totalDuration : item.sessionCount,
    valueText:
      sort.value === 'time' ? formatDuration(item.totalDuration) : `${item.sessionCount}次`,
    icon: getEntityIcon('collection')
  }))
)
</script>

<template>
  <Section :title="props.title">
    <template #actions>
      <SegmentedControl v-model="sort">
        <SegmentedControlItem value="time">时长</SegmentedControlItem>
        <SegmentedControlItem value="count">次数</SegmentedControlItem>
      </SegmentedControl>
    </template>

    <RankingList
      v-if="items.length > 0"
      :items="items"
      :total-value="totalValue"
      expand-title="收藏排行"
    />
    <div
      v-else
      class="flex h-24 items-center justify-center text-sm text-muted-foreground"
    >
      暂无数据
    </div>
  </Section>
</template>
