<script setup lang="ts">
/**
 * Library Layout
 *
 * Route-level parent layout for the library feature.
 * Provides:
 * - Top header (title + global search)
 * - Two-panel resizable layout (explorer + RouterView)
 * - Global Ctrl+F shortcut for search
 */

import { onMounted, onUnmounted, ref } from 'vue'
import { RouterView } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { ResizableHandle, ResizableLayout, ResizablePanel } from '@renderer/components/ui/resizable'
import { useIpc } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { useLibraryExplorerStore } from '../stores'
import { parseExplorerSelectionKey } from '../utils/explorer-selection'
import { LibraryExplorer, LibrarySearchDialog } from '../components'

const { m } = useI18n()

const store = useLibraryExplorerStore()
const { explorerWidth } = storeToRefs(store)

const isSearchOpen = ref(false)

useIpc('library:entity-merged', (_e, event) => {
  const sourceKeys = store.selectedKeys.filter((key) => {
    const selection = parseExplorerSelectionKey(key)
    return selection.id === event.sourceId
  })
  if (sourceKeys.length > 0) {
    store.removeFromSelection(sourceKeys)
  }
})

function handleKeyDown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
    event.preventDefault()
    isSearchOpen.value = true
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="h-full flex flex-col">
    <PageHeader>
      <PageHeaderTitle
        :title="m.library.pages.libraryTitle"
        icon="icon-[mdi--bookshelf]"
      />

      <template #actions>
        <Button
          variant="secondary"
          size="sm"
          @click="isSearchOpen = true"
        >
          <Icon
            icon="icon-[mdi--magnify]"
            class="size-4"
          />
          {{ m.library.pages.globalSearch }}
          <kbd
            class="ml-2 -mr-1 p-0 pointer-events-none h-5 select-none items-center gap-1 rounded px-1.5 font-mono text-xs font-medium text-muted-foreground hidden sm:inline-flex"
          >
            Ctrl F
          </kbd>
        </Button>
      </template>
    </PageHeader>

    <div class="flex-1 min-h-0">
      <ResizableLayout
        v-model:left-width="explorerWidth"
        :default-width="220"
        :min-left-width="180"
        :max-left-width="400"
        class="h-full"
      >
        <ResizablePanel position="left">
          <LibraryExplorer />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel position="right">
          <div class="h-full overflow-hidden">
            <RouterView />
          </div>
        </ResizablePanel>
      </ResizableLayout>
    </div>

    <LibrarySearchDialog v-model:open="isSearchOpen" />
  </div>
</template>
