<!--
  Statistics Layout

  Parent layout component for statistics feature.
  Provides statistics context and contains header with RouterView for child pages.
-->

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
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

    <!-- Main content - one scroll region per report: keyed by path so
         switching reports mounts the next page fresh, at the top. -->
    <ScrollRegion
      :key="route.path"
      class="bg-background"
    >
      <RouterView />
    </ScrollRegion>
  </div>
</template>
