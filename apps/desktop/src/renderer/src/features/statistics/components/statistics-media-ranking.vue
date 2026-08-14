<!--
  Statistics Media Ranking

  Ranked media entry list (covers + share bars) by activity time or session
  count, spanning every media type in the library. Owns its module header:
  Section title with the sort control inline. Shares are relative to the
  period total, not the sum of ranked items.
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStatistics, type StatisticsSessionEntry } from '../composables'
import {
  computeEntityRanking,
  sessionDurationMs,
  type RankingSort
} from '@renderer/utils/statistics'
import { RankingList, type RankingListItem } from '@renderer/components/ui/ranking-list'
import { Section } from '@renderer/components/ui/section'
import { SegmentedControl, SegmentedControlItem } from '@renderer/components/ui/segmented-control'
import { useI18n } from '@renderer/composables/use-i18n'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { getEntityIcon } from '@renderer/utils/format'

const MEDIA_ATTACHMENT_TABLES = { game: 'games', anime: 'animes' } as const

interface Props {
  /** Module header title */
  title: string
  /** Override sessions (for custom data source) */
  sessions?: StatisticsSessionEntry[]
  /** Inline column count for full-width bands */
  columns?: 1 | 2
}

const props = withDefaults(defineProps<Props>(), { columns: 1 })

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
  computeEntityRanking(
    effectiveSessions.value,
    (session) => session.entityKey,
    (entityKey) => context.entities.value.get(entityKey)?.name,
    sort.value
  ).map((item) => {
    const entity = context.entities.value.get(item.id)
    return {
      id: item.id,
      name: item.name,
      value: sort.value === 'time' ? item.totalDuration : item.sessionCount,
      valueText:
        sort.value === 'time'
          ? f.value.duration(item.totalDuration)
          : m.value.statistics.hero.timesValue({ count: item.sessionCount }),
      coverUrl:
        entity?.coverFile != null
          ? getAttachmentUrl(
              MEDIA_ATTACHMENT_TABLES[entity.mediaType],
              entity.id,
              entity.coverFile,
              {
                width: 64,
                height: 64
              }
            )
          : undefined,
      icon: getEntityIcon(entity?.mediaType ?? 'game')
    }
  })
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
      :columns="props.columns"
      :expand-title="m.statistics.ranking.mediaTitle"
    />
    <div
      v-else
      class="flex h-24 items-center justify-center text-sm text-muted-foreground"
    >
      {{ m.common.noData }}
    </div>
  </Section>
</template>
