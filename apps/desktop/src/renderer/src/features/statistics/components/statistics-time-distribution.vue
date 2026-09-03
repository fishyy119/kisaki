<!--
  Statistics Time Distribution

  Shows activity time distribution by hour of day, weekday, or day of month.
  Adapts available options based on report type.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '@renderer/composables/use-i18n'
import { useStatistics } from '../composables'
import {
  TimeDistributionChart,
  type DistributionType
} from '@renderer/components/ui/time-distribution-chart'
import {
  aggregateByLocalDayOfMonth,
  aggregateByLocalHour,
  aggregateByLocalWeekdayMondayFirst,
  type StatisticsSession
} from '@renderer/utils/statistics'

interface Props {
  /** Module header title */
  title?: string
  /** Override sessions (for custom data source) */
  sessions?: StatisticsSession[]
  /** Available distribution types */
  availableTypes?: DistributionType[]
}

const props = withDefaults(defineProps<Props>(), {
  availableTypes: () => ['hourly', 'weekday', 'dayOfMonth']
})

const context = useStatistics()
const { m, f } = useI18n()

const effectiveSessions = computed(() => props.sessions ?? context.sessions.value)

// Local distribution type state
const distributionType = ref<DistributionType>('hourly')

// Reset distribution type when available types change
watch(
  () => props.availableTypes,
  () => {
    distributionType.value = 'hourly'
  }
)

// Aggregate play time based on distribution type
const chartData = computed(() => {
  switch (distributionType.value) {
    case 'hourly': {
      const values = aggregateByLocalHour(effectiveSessions.value)
      return values.map((value, hour) => ({ key: hour, label: `${hour}:00`, value }))
    }
    case 'weekday': {
      const values = aggregateByLocalWeekdayMondayFirst(effectiveSessions.value)
      return values.map((value, day) => ({ key: day, label: f.value.weekdayName(day + 1), value }))
    }
    case 'dayOfMonth': {
      const values = aggregateByLocalDayOfMonth(effectiveSessions.value)
      return values.map((value, i) => ({
        key: i + 1,
        label: m.value.statistics.charts.dayOfMonthLabel({ day: i + 1 }),
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
    :title="props.title"
    :data="chartData"
    :available-types="props.availableTypes"
    :format-value="(v: number) => `${v.toFixed(1)}h`"
    height="14rem"
  />
</template>
