<!--
  Statistics Layout

  Parent layout component for statistics feature.
  Provides statistics context and contains header with RouterView for child pages.
-->

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useStatisticsProvider } from '../composables'
import { StatisticsHeader } from '../components'

const route = useRoute()

// Provide statistics context for all child components
useStatisticsProvider()
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header (includes report type navigation and period selector) -->
    <StatisticsHeader />

    <!-- Main content - each report page owns its scroll region. Keyed by
         path so a page instance belongs to one location. -->
    <div class="flex-1 min-h-0 flex flex-col">
      <RouterView :key="route.path" />
    </div>
  </div>
</template>
