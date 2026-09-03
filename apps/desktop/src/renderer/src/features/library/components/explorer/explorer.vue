<script setup lang="ts">
/**
 * LibraryExplorer - Main Explorer Component
 *
 * Complete entity browser with unified toolbar, list, and footer.
 * Owns the shared list data (one fetch serving list, footer, and locator)
 * and the locator that keeps the current detail route revealed in the list.
 *
 * The list scrolls in a ScrollRegion. The explorer owns the region's element
 * and wires the two devices that watch it, the locator and the back-to-top
 * control; the footer strip renders them, so the region does not.
 */

import { computed, useTemplateRef } from 'vue'
import { ScrollRegion, useBackToTop } from '@renderer/components/ui/scroll-region'
import { LibraryExplorerToolbar } from './toolbar'
import LibraryExplorerList from './explorer-list.vue'
import LibraryExplorerFooter from './explorer-footer.vue'
import { useExplorerListProvider, useExplorerLocatorProvider } from '../../composables'

const region = useTemplateRef<InstanceType<typeof ScrollRegion>>('region')
const scrollElement = computed<HTMLElement | undefined>(() => region.value?.element)

const list = useExplorerListProvider()
useExplorerLocatorProvider({ list, scrollContainer: scrollElement })
const backToTop = useBackToTop(scrollElement)
</script>

<template>
  <div class="h-full flex flex-col bg-background border-r">
    <!-- Unified toolbar: nav, tabs, search, filter -->
    <LibraryExplorerToolbar />

    <!-- Entity list -->
    <ScrollRegion
      ref="region"
      :back-to-top="false"
    >
      <LibraryExplorerList />
    </ScrollRegion>

    <!-- Footer with stats and scroll aids -->
    <LibraryExplorerFooter :back-to-top="backToTop" />
  </div>
</template>
