<!--
  Statistics Weekly Page

  One week in review. Full-bleed partitioned surface built from horizontal
  bands: hero, day heatmap, charts band (daily trend | time of day), and a
  full-width game ranking flowing in two columns. Every divider spans the
  full row.
-->

<script setup lang="ts">
import { useStatistics } from '../composables'
import { useRenderState } from '@renderer/composables'
import { StateView } from '@renderer/components/ui/state-view'
import {
  StatisticsHero,
  StatisticsActivityHeatmap,
  StatisticsTimeTrend,
  StatisticsTimeDistribution,
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

  <div
    v-else
    class="divide-y"
  >
    <div class="p-4">
      <StatisticsHero />
    </div>

    <div class="p-4">
      <StatisticsActivityHeatmap
        title="活动热力图"
        :available-granularities="['day']"
      />
    </div>

    <!-- Charts band -->
    <div class="grid grid-cols-1 divide-y xl:grid-cols-[2fr_1fr] xl:divide-y-0">
      <div class="min-w-0 p-4">
        <StatisticsTimeTrend
          title="游玩趋势"
          :available-granularities="['daily']"
        />
      </div>
      <div class="min-w-0 p-4 xl:border-l">
        <StatisticsTimeDistribution
          title="时段分布"
          :available-types="['hourly']"
        />
      </div>
    </div>

    <!-- Rankings band: full-width game ranking, rows flowing in two columns -->
    <div class="p-4">
      <StatisticsGameRanking
        title="游戏排行"
        :columns="2"
      />
    </div>
  </div>
</template>
