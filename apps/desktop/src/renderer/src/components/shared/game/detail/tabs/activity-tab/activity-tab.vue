<!--
  Game Detail Activity Tab

  Activity tab showing game play history, statistics, and charts.
  Uses sessions data from useGame() context.
-->

<script setup lang="ts">
import { useGame } from '@renderer/composables/use-game'
import { useRenderState } from '@renderer/composables'
import { StateView } from '@renderer/components/ui/state-view'
import { Section } from '@renderer/components/ui/section'
import GameDetailActivityEmpty from './activity-empty.vue'
import GameDetailActivityStats from './activity-stats.vue'
import GameDetailActivityHeatmap from './activity-heatmap.vue'
import GameDetailActivityTrend from './activity-trend.vue'
import GameDetailActivityDistribution from './activity-distribution.vue'

// Get sessions from game context
const { sessions, isLoading, error } = useGame()
const state = useRenderState(isLoading, error, sessions)
</script>

<template>
  <!-- Loading -->
  <StateView
    v-if="state === 'loading'"
    state="loading"
    class="py-12"
  />

  <!-- Empty -->
  <GameDetailActivityEmpty v-else-if="sessions.length === 0" />

  <!-- Content -->
  <div
    v-else
    class="space-y-6"
  >
    <!-- Stats Summary -->
    <Section title="统计概览">
      <GameDetailActivityStats :sessions="sessions" />
    </Section>

    <!-- Activity Heatmap -->
    <Section title="活动热力图">
      <div class="rounded-lg border bg-card p-4">
        <GameDetailActivityHeatmap :sessions="sessions" />
      </div>
    </Section>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
      <!-- Time Trend -->
      <Section
        title="游玩趋势"
        class="flex h-full flex-col"
      >
        <div class="flex-1 rounded-lg border bg-card p-4">
          <GameDetailActivityTrend :sessions="sessions" />
        </div>
      </Section>

      <!-- Daily Distribution -->
      <Section
        title="时段分布"
        class="flex h-full flex-col"
      >
        <div class="flex-1 rounded-lg border bg-card p-4">
          <GameDetailActivityDistribution :sessions="sessions" />
        </div>
      </Section>
    </div>
  </div>
</template>
