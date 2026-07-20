<!--
  RootLayout
  Application root layout with the lightbox luminaire (light + diffuser
  layers), Titlebar, Sidebar, and main content slot. Containers stay
  transparent; every visible region (titlebar, sidebar, page headers, page
  bodies) paints exactly one translucent base pane over the light layers so
  transmission is uniform window-wide.
-->
<script setup lang="ts">
import { TooltipProvider } from '@renderer/components/ui/tooltip'

import AmbientLight from './ambient-light.vue'
import NavigationProgress from './navigation-progress.vue'
import Sidebar from './sidebar.vue'
import Titlebar from './titlebar.vue'
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <div class="relative h-screen flex flex-col overflow-hidden">
      <!-- Lightbox light + diffuser layers under everything -->
      <AmbientLight />

      <!-- Route navigation loading indicator -->
      <NavigationProgress />

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
