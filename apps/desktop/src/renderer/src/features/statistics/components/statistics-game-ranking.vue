<!--
  Statistics Game Ranking

  Ranked game list (covers + share bars) by play time or session count.
  Owns its module header: Section title with the sort control inline.
  Shares are relative to the period total, not the sum of ranked items.
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStatistics } from '../composables'
import { computeGameRanking, sessionDurationMs, type RankingSort } from '@renderer/utils/statistics'
import { RankingList, type RankingListItem } from '@renderer/components/ui/ranking-list'
import { Section } from '@renderer/components/ui/section'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { formatDuration } from '@renderer/utils/datetime'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { getEntityIcon } from '@renderer/utils/format'
import type { GameSession } from '@shared/db'

interface Props {
  /** Module header title */
  title: string
  /** Override sessions (for custom data source) */
  sessions?: GameSession[]
  /** Inline column count for full-width bands */
  columns?: 1 | 2
}

const props = withDefaults(defineProps<Props>(), { columns: 1 })

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
  computeGameRanking(effectiveSessions.value, context.games.value, sort.value).map((item) => {
    const game = context.games.value.get(item.id)
    return {
      id: item.id,
      name: item.name,
      value: sort.value === 'time' ? item.totalDuration : item.sessionCount,
      valueText:
        sort.value === 'time' ? formatDuration(item.totalDuration) : `${item.sessionCount}次`,
      coverUrl: game?.coverFile
        ? getAttachmentUrl('games', game.id, game.coverFile, { width: 64, height: 64 })
        : undefined,
      icon: getEntityIcon('game')
    }
  })
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
      :columns="props.columns"
      expand-title="游戏排行"
    />
    <div
      v-else
      class="flex h-24 items-center justify-center text-sm text-muted-foreground"
    >
      暂无数据
    </div>
  </Section>
</template>
