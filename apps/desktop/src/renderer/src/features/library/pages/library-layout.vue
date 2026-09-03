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
import { RouterView, useRoute } from 'vue-router'
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
const route = useRoute()

const store = useLibraryExplorerStore()
const { explorerWidthRem } = storeToRefs(store)

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
        <!-- One content-sized action, the same at every width: the shortcut hint
             is part of the label, never hidden by the header's width -->
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
            class="pointer-events-none ml-2 -mr-1 inline-flex h-5 select-none items-center gap-1 rounded p-0 px-1.5 font-mono text-xs font-medium text-muted-foreground"
          >
            Ctrl F
          </kbd>
        </Button>
      </template>
    </PageHeader>

    <div class="flex-1 min-h-0">
      <!-- Rail bounds in rem: the floor holds the seven-type scope row, the
           ceiling keeps the content pane at its minimum on the window floor -->
      <ResizableLayout
        v-model:left-width="explorerWidthRem"
        :default-width="16"
        :min-left-width="16"
        :max-left-width="28"
        class="h-full"
      >
        <ResizablePanel position="left">
          <LibraryExplorer />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel position="right">
          <!-- Keyed by path: a page instance belongs to one location, so a
               param change (game A to game B) mounts fresh instead of reusing. -->
          <div class="h-full overflow-hidden">
            <RouterView :key="route.path" />
          </div>
        </ResizablePanel>
      </ResizableLayout>
    </div>

    <LibrarySearchDialog v-model:open="isSearchOpen" />
  </div>
</template>
