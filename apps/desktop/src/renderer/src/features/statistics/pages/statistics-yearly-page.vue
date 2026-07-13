<!--
  Statistics Yearly Page

  Yearly report showing full visualizations for a specific year.
  Features: Stats with X/365 active days, most active month, monthly average,
  full year heatmap, monthly trend, all distributions and rankings.
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
      <!-- Stats Summary (with X/365 active days, most active month, monthly avg) -->
      <Section title="年度概览">
        <StatisticsStatsSummary report-type="yearly" />
      </Section>

      <!-- Activity Heatmap (full year) -->
      <Section title="活动热力图">
        <div class="rounded-lg border bg-card p-4">
          <StatisticsActivityHeatmap />
        </div>
      </Section>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 items-stretch">
        <!-- Monthly Trend -->
        <Section
          title="游玩趋势"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border bg-card p-4">
            <StatisticsTimeTrend />
          </div>
        </Section>

        <!-- Time Distribution (all options) -->
        <Section
          title="时段分布"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border bg-card p-4">
            <StatisticsTimeDistribution />
          </div>
        </Section>
      </div>

      <!-- Distribution Pie Charts Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        <!-- Game Distribution -->
        <Section
          title="游戏分布"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border bg-card p-4">
            <StatisticsGameDistribution />
          </div>
        </Section>

        <!-- Tag Distribution -->
        <Section
          title="标签分布"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border bg-card p-4">
            <StatisticsTagDistribution />
          </div>
        </Section>

        <!-- Collection Distribution -->
        <Section
          title="收藏分布"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border bg-card p-4">
            <StatisticsCollectionDistribution />
          </div>
        </Section>
      </div>

      <!-- Rankings Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        <!-- Game Ranking -->
        <Section
          title="游戏排行"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border bg-card p-4">
            <StatisticsGameRanking />
          </div>
        </Section>

        <!-- Tag Ranking -->
        <Section
          title="标签排行"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border bg-card p-4">
            <StatisticsTagRanking />
          </div>
        </Section>

        <!-- Collection Ranking -->
        <Section
          title="收藏排行"
          class="flex h-full flex-col"
        >
          <div class="flex-1 rounded-lg border bg-card p-4">
            <StatisticsCollectionRanking />
          </div>
        </Section>
      </div>
    </div>
  </template>
</template>
