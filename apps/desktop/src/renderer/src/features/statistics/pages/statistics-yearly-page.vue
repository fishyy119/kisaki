<!--
  Statistics Yearly Page

  One year in review. Full-bleed partitioned surface built from horizontal
  bands: hero, year activity calendar, charts band (seasonality trend |
  time of day), rankings band (titles | collections). Every divider spans
  the full row, so lines always close.
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
  StatisticsMediaRanking,
  StatisticsCollectionRanking
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
        :available-granularities="['day', 'week', 'month']"
      />
    </div>

    <!-- Charts band -->
    <div class="grid grid-cols-1 divide-y xl:grid-cols-[2fr_1fr] xl:divide-y-0">
      <div class="min-w-0 p-4">
        <StatisticsTimeTrend
          :title="m.statistics.charts.trendTitle"
          :available-granularities="['weekly', 'monthly']"
          default-granularity="monthly"
        />
      </div>
      <div class="min-w-0 p-4 xl:border-l">
        <StatisticsTimeDistribution :title="m.statistics.charts.distributionTitle" />
      </div>
    </div>

    <!-- Rankings band: last row, so uneven column ends fall off the page -->
    <div class="grid grid-cols-1 divide-y xl:grid-cols-2 xl:divide-y-0">
      <div class="min-w-0 p-4">
        <StatisticsMediaRanking :title="m.statistics.ranking.mediaTitle" />
      </div>
      <div class="min-w-0 p-4 xl:border-l">
        <StatisticsCollectionRanking :title="m.statistics.ranking.collectionTitle" />
      </div>
    </div>
  </div>
</template>
