<!--
  Media Activity Heatmap

  Activity heatmap showing session frequency over time.
  Uses the generic Heatmap component.
-->

<script setup lang="ts">
import { computed } from 'vue'
import { Heatmap, type HeatmapDataPoint } from '@renderer/components/ui/heatmap'
import type { MediaSessionRow } from '../media-tables'

interface Props {
  sessions: MediaSessionRow[]
}

const props = defineProps<Props>()

const range = computed(() => {
  if (props.sessions.length === 0) return null

  let start = props.sessions[0]!.startedAt
  let end = props.sessions[0]!.endedAt

  for (const session of props.sessions) {
    if (session.startedAt < start) start = session.startedAt
    if (session.endedAt > end) end = session.endedAt
  }

  return { start, end }
})

// Transform sessions to heatmap data points
const heatmapData = computed<HeatmapDataPoint[]>(() => {
  return props.sessions.map((session) => ({
    date: session.startedAt,
    value: session.endedAt.getTime() - session.startedAt.getTime()
  }))
})
</script>

<template>
  <Heatmap
    v-if="range"
    :range="range"
    :data="heatmapData"
  />
</template>
