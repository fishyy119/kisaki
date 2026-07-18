<!--
  Statistics Overview Page

  Overview report showing past year data for time-based visualizations
  and all-time data for stats/distributions/rankings.
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
  StatisticsTagDistribution,
  StatisticsCollectionDistribution,
  StatisticsGameRanking,
  StatisticsTagRanking,
  StatisticsCollectionRanking
} from '../components'

const { sessions, allTimeSessions, allTimeStats, isLoading, error, timeBasedDateRange } =
  useStatistics()

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
      <!-- Stats Summary (all-time data) -->
      <Section title="统计概览">
        <StatisticsStatsSummary
          :stats="allTimeStats"
          :sessions="allTimeSessions"
        />
      </Section>

      <!-- Activity Heatmap (past year) -->
      <Section title="活动热力图">
        <div class="rounded-lg border p-4">
          <StatisticsActivityHeatmap
            :sessions="sessions"
            :date-range="timeBasedDateRange"
          />
        </div>
      </Section>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 items-stretch">
        <!-- Time Trend (past year) -->
        <Section
          title="游玩趋势"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border p-4">
            <StatisticsTimeTrend
              :sessions="sessions"
              :date-range="timeBasedDateRange"
            />
          </div>
        </Section>

        <!-- Time Distribution (past year) -->
        <Section
          title="时段分布"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border p-4">
            <StatisticsTimeDistribution :sessions="sessions" />
          </div>
        </Section>
      </div>

      <!-- Distribution Pie Charts Grid (all-time data) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        <!-- Game Distribution -->
        <Section
          title="游戏分布"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border p-4">
            <StatisticsGameDistribution :sessions="allTimeSessions" />
          </div>
        </Section>

        <!-- Tag Distribution -->
        <Section
          title="标签分布"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border p-4">
            <StatisticsTagDistribution :sessions="allTimeSessions" />
          </div>
        </Section>

        <!-- Collection Distribution -->
        <Section
          title="收藏分布"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border p-4">
            <StatisticsCollectionDistribution :sessions="allTimeSessions" />
          </div>
        </Section>
      </div>

      <!-- Rankings Grid (all-time data) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        <!-- Game Ranking -->
        <Section
          title="游戏排行"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border p-4">
            <StatisticsGameRanking :sessions="allTimeSessions" />
          </div>
        </Section>

        <!-- Tag Ranking -->
        <Section
          title="标签排行"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border p-4">
            <StatisticsTagRanking :sessions="allTimeSessions" />
          </div>
        </Section>

        <!-- Collection Ranking -->
        <Section
          title="收藏排行"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border p-4">
            <StatisticsCollectionRanking :sessions="allTimeSessions" />
          </div>
        </Section>
      </div>
    </div>
  </template>
</template>
