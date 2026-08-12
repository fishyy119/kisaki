<!--
  Statistics Collection Ranking

  Ranked collection list (share bars) by activity time or session count. Owns
  its module header: Section title with the sort control inline. Shares are
  relative to the period total (a session counts under each collection that
  contains its entry).
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStatistics, type StatisticsSessionEntry } from '../composables'
import {
  computeCollectionRanking,
  sessionDurationMs,
  type RankingSort
} from '@renderer/utils/statistics'
import { RankingList, type RankingListItem } from '@renderer/components/ui/ranking-list'
import { Section } from '@renderer/components/ui/section'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityIcon } from '@renderer/utils/format'

interface Props {
  /** Module header title */
  title: string
  /** Override sessions (for custom data source) */
  sessions?: StatisticsSessionEntry[]
}

const props = defineProps<Props>()

const context = useStatistics()
const { m, f } = useI18n()

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
    (session) => session.entityKey,
    context.entityCollectionLinks.value,
    context.collections.value,
    sort.value
  ).map((item) => ({
    id: item.id,
    name: item.name,
    value: sort.value === 'time' ? item.totalDuration : item.sessionCount,
    valueText:
      sort.value === 'time'
        ? f.value.duration(item.totalDuration)
        : m.value.statistics.hero.timesValue({ count: item.sessionCount }),
    icon: getEntityIcon('collection')
  }))
)
</script>

<template>
  <Section :title="props.title">
    <template #actions>
      <SegmentedControl v-model="sort">
        <SegmentedControlItem value="time">{{
          m.statistics.ranking.sortTime
        }}</SegmentedControlItem>
        <SegmentedControlItem value="count">{{
          m.statistics.ranking.sortCount
        }}</SegmentedControlItem>
      </SegmentedControl>
    </template>

    <RankingList
      v-if="items.length > 0"
      :items="items"
      :total-value="totalValue"
      :expand-title="m.statistics.ranking.collectionTitle"
    />
    <div
      v-else
      class="flex h-24 items-center justify-center text-sm text-muted-foreground"
    >
      {{ m.common.noData }}
    </div>
  </Section>
</template>
