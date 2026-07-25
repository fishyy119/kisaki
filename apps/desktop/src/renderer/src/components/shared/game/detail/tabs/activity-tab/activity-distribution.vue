<!--
  Game Detail Activity Distribution

  Shows play time distribution by hour of day, weekday, or day of month.
  Uses TimeDistributionChart UI component with sessions from game context.
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GameSession } from '@shared/db'
import {
  aggregateByLocalDayOfMonth,
  aggregateByLocalHour,
  aggregateByLocalWeekdayMondayFirst
} from '@renderer/utils/statistics'
import {
  TimeDistributionChart,
  type DistributionType
} from '@renderer/components/ui/time-distribution-chart'
import { useI18n } from '@renderer/composables'

interface Props {
  sessions: GameSession[]
}

const props = defineProps<Props>()
const { m, f } = useI18n()

const distributionType = ref<DistributionType>('hourly')

// Aggregate play time based on distribution type
const chartData = computed(() => {
  switch (distributionType.value) {
    case 'hourly': {
      const values = aggregateByLocalHour(props.sessions)
      return values.map((value, hour) => ({ key: hour, label: `${hour}:00`, value }))
    }
    case 'weekday': {
      const values = aggregateByLocalWeekdayMondayFirst(props.sessions)
      // Aggregation is Monday-first; ISO day 1 is Monday.
      return values.map((value, day) => ({ key: day, label: f.value.weekdayName(day + 1), value }))
    }
    case 'dayOfMonth': {
      const values = aggregateByLocalDayOfMonth(props.sessions)
      return values.map((value, i) => ({
        key: i + 1,
        label: m.value.game.activity.dayOfMonthLabel({ day: i + 1 }),
        value
      }))
    }
    default: {
      const _exhaustive: never = distributionType.value
      return _exhaustive
    }
  }
})
</script>

<template>
  <TimeDistributionChart
    v-model:distribution-type="distributionType"
    :data="chartData"
    :format-value="(v: number) => `${v.toFixed(1)}h`"
    :height="200"
  />
</template>
