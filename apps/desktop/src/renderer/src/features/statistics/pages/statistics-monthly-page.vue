<!--
  Statistics Monthly Page

  Monthly report showing visualizations for a specific month.
  Features: Stats with X/N active days, calendar heatmap, weekly trend,
  hourly/weekday distribution, game distribution and ranking.
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useStatistics } from '../composables'
import { useRenderState } from '@renderer/composables'
import { StateView } from '@renderer/components/ui/state-view'
import { Section } from '@renderer/components/ui/section'
import {
  StatisticsStatsSummary,
  StatisticsActivityHeatmap,
  StatisticsTimeTrend,
  StatisticsTimeDistribution,
  StatisticsGameDistribution,
  StatisticsGameRanking
} from '../components'

const { sessions, currentPeriod, isLoading, error } = useStatistics()

const state = useRenderState(isLoading, error, sessions)

// Calculate days in the current month
const daysInMonth = computed(() => {
  return new Date(currentPeriod.value.year, currentPeriod.value.month!, 0).getDate()
})
</script>

<template>
  <StateView
    v-if="state !== 'success'"
    :state="state"
    :error="error"
    class="h-full"
  />

  <!-- Success -->
  <template v-else>
    <!-- Content -->
    <div class="space-y-6">
      <!-- Stats Summary (with X/N active days) -->
      <Section title="本月概览">
        <StatisticsStatsSummary
          report-type="monthly"
          :total-days="daysInMonth"
        />
      </Section>

      <!-- Activity Heatmap (month calendar) -->
      <Section title="活动热力图">
        <div class="rounded-lg border p-4">
          <StatisticsActivityHeatmap :available-granularities="['day', 'week']" />
        </div>
      </Section>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 items-stretch">
        <!-- Weekly Trend -->
        <Section
          title="游玩趋势"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border p-4">
            <StatisticsTimeTrend :available-granularities="['daily', 'weekly']" />
          </div>
        </Section>

        <!-- Time Distribution (hourly, weekday) -->
        <Section
          title="时段分布"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border p-4">
            <StatisticsTimeDistribution :available-types="['hourly', 'weekday']" />
          </div>
        </Section>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 items-stretch">
        <!-- Game Distribution -->
        <Section
          title="游戏分布"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border p-4">
            <StatisticsGameDistribution />
          </div>
        </Section>

        <!-- Game Ranking -->
        <Section
          title="游戏排行"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border p-4">
            <StatisticsGameRanking />
          </div>
        </Section>
      </div>
    </div>
  </template>
</template>
