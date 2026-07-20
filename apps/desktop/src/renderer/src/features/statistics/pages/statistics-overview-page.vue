<!--
  Statistics Overview Page

  All-time retrospective. Full-bleed partitioned surface built from
  horizontal bands: hero, past-year heatmap, charts band (trend | time of
  day), rankings band (games | collections). Every divider spans the full
  row, so lines always close; cells inside a band share one height.
-->

<script setup lang="ts">
import { useStatistics } from '../composables'
import { StateView } from '@renderer/components/ui/state-view'
import {
  StatisticsHero,
  StatisticsActivityHeatmap,
  StatisticsTimeTrend,
  StatisticsTimeDistribution,
  StatisticsGameRanking,
  StatisticsCollectionRanking
} from '../components'

const { allTimeSessions, error } = useStatistics()
</script>

<template>
  <StateView
    v-if="error"
    state="error"
    :error="error"
    class="h-full"
  />

  <div
    v-else
    class="divide-y"
  >
    <div class="p-4">
      <StatisticsHero />
    </div>

    <div class="p-4">
      <StatisticsActivityHeatmap title="活动热力图" />
    </div>

    <!-- Charts band -->
    <div class="grid grid-cols-1 divide-y xl:grid-cols-[2fr_1fr] xl:divide-y-0">
      <div class="min-w-0 p-4">
        <StatisticsTimeTrend
          title="游玩趋势"
          default-granularity="monthly"
        />
      </div>
      <div class="min-w-0 p-4 xl:border-l">
        <StatisticsTimeDistribution title="时段分布" />
      </div>
    </div>

    <!-- Rankings band: last row, so uneven column ends fall off the page -->
    <div class="grid grid-cols-1 divide-y xl:grid-cols-2 xl:divide-y-0">
      <div class="min-w-0 p-4">
        <StatisticsGameRanking
          title="游戏排行"
          :sessions="allTimeSessions"
        />
      </div>
      <div class="min-w-0 p-4 xl:border-l">
        <StatisticsCollectionRanking
          title="收藏排行"
          :sessions="allTimeSessions"
        />
      </div>
    </div>
  </div>
</template>
