<script setup lang="ts">
/**
 * LibraryExplorer - Main Explorer Component
 *
 * Complete entity browser with unified toolbar, list, and footer.
 * Owns the shared list data (one fetch serving list, footer, and locator)
 * and the locator that keeps the current detail route revealed in the list.
 *
 * The list scrolls in a ScrollRegion with a fixed identity: the explorer is
 * the one persistent surface of the library, so leaving `/library` and
 * coming back finds it where it was. The footer strip renders the back-to-top
 * device, so the region does not.
 */

import { computed, useTemplateRef } from 'vue'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { LibraryExplorerToolbar } from './toolbar'
import LibraryExplorerList from './explorer-list.vue'
import LibraryExplorerFooter from './explorer-footer.vue'
import { useExplorerListProvider, useExplorerLocatorProvider } from '../../composables'

/** Memory identity of the explorer's list viewport. */
const EXPLORER_SCROLL_MEMORY = 'library-explorer'

const region = useTemplateRef<InstanceType<typeof ScrollRegion>>('region')
const scrollElement = computed<HTMLElement | undefined>(() => region.value?.element)

const list = useExplorerListProvider()
useExplorerLocatorProvider({ list, scrollContainer: scrollElement })
</script>

<template>
  <div class="h-full flex flex-col bg-background border-r">
    <!-- Unified toolbar: nav, tabs, search, filter -->
    <LibraryExplorerToolbar />

    <!-- Entity list -->
    <ScrollRegion
      ref="region"
      :memory="EXPLORER_SCROLL_MEMORY"
      :back-to-top="false"
    >
      <LibraryExplorerList />
    </ScrollRegion>

    <!-- Footer with stats and scroll aids -->
    <LibraryExplorerFooter :scroll-element="scrollElement" />
  </div>
</template>
