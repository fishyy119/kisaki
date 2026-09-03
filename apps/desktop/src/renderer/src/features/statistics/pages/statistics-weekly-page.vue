<!--
  Statistics Weekly Page

  One week in review. Full-bleed partitioned surface built from horizontal
  bands: hero, day heatmap, charts band (daily trend | time of day), and a
  full-width title ranking flowing in two columns. Every divider spans the
  full row.
-->

<script setup lang="ts">
import { useI18n } from '@renderer/composables/use-i18n'
import { useStatistics } from '../composables'
import { StateView } from '@renderer/components/ui/state-view'
import {
  StatisticsHero,
  StatisticsActivityHeatmap,
  StatisticsTimeTrend,
  StatisticsTimeDistribution,
  StatisticsMediaRanking
} from '../components'

const { m } = useI18n()

const { error } = useStatistics()
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
      <StatisticsActivityHeatmap
        :title="m.statistics.charts.heatmapTitle"
        :available-granularities="['day']"
      />
    </div>

    <!-- Charts band -->
    <div class="grid grid-cols-1 divide-y @7xl:grid-cols-[2fr_1fr] @7xl:divide-y-0">
      <div class="min-w-0 p-4">
        <StatisticsTimeTrend
          :title="m.statistics.charts.trendTitle"
          :available-granularities="['daily']"
        />
      </div>
      <div class="min-w-0 p-4 @4xl:border-l">
        <StatisticsTimeDistribution
          :title="m.statistics.charts.distributionTitle"
          :available-types="['hourly']"
        />
      </div>
    </div>

    <!-- Rankings band: full-width title ranking, rows flowing in two columns -->
    <div class="p-4">
      <StatisticsMediaRanking
        :title="m.statistics.ranking.mediaTitle"
        :columns="2"
      />
    </div>
  </div>
</template>
