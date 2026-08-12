<!--
  Statistics Activity Heatmap

  Activity heatmap showing activity frequency over time.
  Uses the generic Heatmap UI component.
-->

<script setup lang="ts">
import { computed } from 'vue'
import { Heatmap, type HeatmapGranularity } from '@renderer/components/ui/heatmap'
import { useStatistics } from '../composables'
import type { StatisticsSession } from '@renderer/utils/statistics'

interface Props {
  /** Module header title */
  title?: string
  /** Override sessions (for custom data source) */
  sessions?: StatisticsSession[]
  /** Override date range (for custom range) */
  dateRange?: { start: Date; end: Date }
  /** Available heatmap granularities */
  availableGranularities?: HeatmapGranularity[]
}

const props = withDefaults(defineProps<Props>(), {
  availableGranularities: () => ['day', 'week', 'month']
})

const context = useStatistics()

const effectiveSessions = computed(() => props.sessions ?? context.sessions.value)
const effectiveDateRange = computed(() => props.dateRange ?? context.dateRange.value)

const heatmapData = computed(() => {
  return effectiveSessions.value.map((s) => ({
    date: s.startedAt,
    value: s.endedAt.getTime() - s.startedAt.getTime()
  }))
})
</script>

<template>
  <Heatmap
    :title="props.title"
    :range="effectiveDateRange"
    :data="heatmapData"
    :available-granularities="props.availableGranularities"
  />
</template>
