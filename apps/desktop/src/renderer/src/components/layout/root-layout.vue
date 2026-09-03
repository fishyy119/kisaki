<!--
  RootLayout
  Application root layout with the lightbox luminaire (light + diffuser
  layers), Titlebar, Sidebar, and main content slot. Containers stay
  transparent; every visible region (titlebar, sidebar, page headers, page
  bodies) paints exactly one translucent base pane over the light layers so
  transmission is uniform window-wide.

  The area below the titlebar is the modal region: it hosts the modal layer
  dialogs portal into, so a modal covers sidebar and content (modality) but
  never the window chrome, which stays draggable and operable.
-->
<script setup lang="ts">
import { MODAL_LAYER_CLASS, MODAL_LAYER_ID } from '@renderer/components/ui/dialog'
import { TooltipProvider } from '@renderer/components/ui/tooltip'

import AmbientLight from './ambient-light.vue'
import NavigationProgress from './navigation-progress.vue'
import Sidebar from './sidebar.vue'
import Titlebar from './titlebar.vue'
</script>

<template>
  <TooltipProvider>
    <div class="relative h-screen flex flex-col overflow-hidden">
      <!-- Lightbox light + diffuser layers under everything -->
      <AmbientLight />

      <!-- Route navigation loading indicator -->
      <NavigationProgress />

      <!-- Top titlebar with window controls -->
      <Titlebar />

      <!-- Main area: Sidebar + Content, and the modal region over both -->
      <div class="relative flex-1 flex overflow-hidden">
        <!-- Declared first so the portal target exists before any page mounts -->
        <div
          :id="MODAL_LAYER_ID"
          :class="MODAL_LAYER_CLASS"
        />

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
