<!--
  RootLayout
  Application root layout with the ambient light layer, Titlebar, Sidebar,
  and main content slot. Containers stay transparent; every visible region
  (titlebar, sidebar, page headers, page bodies) paints exactly one depth
  plane color over the glow so light transmission is uniform window-wide.
-->
<script setup lang="ts">
import { TooltipProvider } from '@renderer/components/ui/tooltip'

import AmbientLight from './ambient-light.vue'
import Sidebar from './sidebar.vue'
import Titlebar from './titlebar.vue'
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <div class="h-screen flex flex-col overflow-hidden">
      <!-- Ambient light under everything -->
      <AmbientLight />

      <!-- Top titlebar with window controls -->
      <Titlebar />

      <!-- Main area: Sidebar + Content -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Left sidebar navigation -->
        <Sidebar />

        <!-- Main content area -->
        <main class="flex-1 overflow-hidden">
          <slot />
        </main>
      </div>
    </div>
  </TooltipProvider>
</template>
