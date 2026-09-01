<script setup lang="ts">
/**
 * LibraryExplorer - Main Explorer Component
 *
 * Complete entity browser with unified toolbar, list, and footer.
 * Owns the shared list data (one fetch serving list, footer, and locator)
 * and the locator that keeps the current detail route revealed in the list.
 */

import { ref, provide } from 'vue'
import { LibraryExplorerToolbar } from './toolbar'
import LibraryExplorerList from './explorer-list.vue'
import LibraryExplorerFooter from './explorer-footer.vue'
import { useExplorerListProvider, useExplorerLocatorProvider } from '../../composables'

// Scroll container ref for virtual list
const scrollContainerRef = ref<HTMLElement>()

// Provide scroll container to children
provide('explorerScrollContainer', scrollContainerRef)

const list = useExplorerListProvider()
useExplorerLocatorProvider({ list, scrollContainer: scrollContainerRef })
</script>

<template>
  <div class="h-full flex flex-col bg-background border-r">
    <!-- Unified toolbar: nav, tabs, search, filter -->
    <LibraryExplorerToolbar />

    <!-- Entity list -->
    <div
      ref="scrollContainerRef"
      class="flex-1 min-h-0 overflow-auto"
    >
      <LibraryExplorerList />
    </div>

    <!-- Footer with stats -->
    <LibraryExplorerFooter />
  </div>
</template>
