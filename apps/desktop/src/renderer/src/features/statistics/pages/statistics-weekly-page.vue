<!--
  Statistics Weekly Page

  Weekly report showing simplified visualizations for a specific week.
  Features: Stats with X/7 active days, daily breakdown, hourly distribution,
  game distribution and ranking.
-->

<script setup lang="ts">
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

const { sessions, isLoading, error } = useStatistics()

const state = useRenderState(isLoading, error, sessions)
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
      <!-- Stats Summary (with X/7 active days) -->
      <Section title="本周概览">
        <StatisticsStatsSummary
          report-type="weekly"
          :total-days="7"
        />
      </Section>

      <!-- Activity Heatmap (7 days) -->
      <Section title="活动热力图">
        <div class="rounded-lg border bg-card p-4">
          <StatisticsActivityHeatmap :available-granularities="['day']" />
        </div>
      </Section>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 items-stretch">
        <!-- Daily Breakdown (trend chart with daily only) -->
        <Section
          title="游玩趋势"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border bg-card p-4">
            <StatisticsTimeTrend :available-granularities="['daily']" />
          </div>
        </Section>

        <!-- Hourly Distribution -->
        <Section
          title="时段分布"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border bg-card p-4">
            <StatisticsTimeDistribution :available-types="['hourly']" />
          </div>
        </Section>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 items-stretch">
        <!-- Game Distribution -->
        <Section
          title="游戏分布"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border bg-card p-4">
            <StatisticsGameDistribution />
          </div>
        </Section>

        <!-- Game Ranking -->
        <Section
          title="游戏排行"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border bg-card p-4">
            <StatisticsGameRanking />
          </div>
        </Section>
      </div>
    </div>
  </template>
</template>
