<!--
Extension Installed Panel renders installed extension management.
Boundary: owns the installed extension list and its filtering; update checks
and their state live in the installed extension store.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { StateView } from '@renderer/components/ui/state-view'
import { resolveExtensionText } from '@renderer/core/extensions'
import { useIpc } from '@renderer/composables/use-ipc'
import { useI18n } from '@renderer/composables/use-i18n'
import ExtensionInstalledPanelCard from './installed-panel-card.vue'
import ExtensionInstalledPanelFilterBar from './installed-panel-filter-bar.vue'
import { useInstalledExtensionStore } from '../../stores'
import { installedExtensionsQuery } from '../../composables'

const store = useInstalledExtensionStore()
const { updates } = storeToRefs(store)
const { m } = useI18n()

// Committed by the route query before the page mounts; the query reloads
// itself on installation and runtime state changes.
const { data: extensions, error } = installedExtensionsQuery()

const extensionsList = computed(() => extensions.value ?? [])

// A changed installation set invalidates the last update check.
useIpc('extension:installations-changed', () => {
  store.resetUpdateCheck()
})

function getUpdateInfo(extensionId: string) {
  return updates.value.find((u) => u.extensionId === extensionId)
}

// Filter and sort extensions
const filteredExtensions = computed(() => {
  let result = [...extensionsList.value]

  // Search filter
  if (store.searchQuery) {
    const query = store.searchQuery.toLowerCase()
    result = result.filter(
      (p) =>
        resolveExtensionText(p.name).toLowerCase().includes(query) ||
        resolveExtensionText(p.description)?.toLowerCase().includes(query) ||
        p.author?.toLowerCase().includes(query)
    )
  }

  // Status filter
  if (store.statusFilter === 'enabled') {
    result = result.filter((p) => p.enabled)
  } else if (store.statusFilter === 'disabled') {
    result = result.filter((p) => !p.enabled)
  }

  // Category filter
  if (store.selectedCategory) {
    result = result.filter((p) => p.categories.includes(store.selectedCategory!))
  }

  // Updates filter
  if (store.showUpdatesOnly) {
    result = result.filter((p) => updates.value.some((u) => u.extensionId === p.id))
  }

  // Sort
  result.sort((a, b) => {
    let comparison = 0
    switch (store.sortField) {
      case 'name':
        comparison = resolveExtensionText(a.name).localeCompare(resolveExtensionText(b.name))
        break
      case 'status':
        comparison = (a.enabled ? 1 : 0) - (b.enabled ? 1 : 0)
        break
      case 'hasUpdate': {
        const aHasUpdate = updates.value.some((u) => u.extensionId === a.id) ? 1 : 0
        const bHasUpdate = updates.value.some((u) => u.extensionId === b.id) ? 1 : 0
        comparison = aHasUpdate - bHasUpdate
        break
      }
    }
    return store.sortDirection === 'asc' ? comparison : -comparison
  })

  return result
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Filter Bar -->
    <ExtensionInstalledPanelFilterBar />

    <!-- Extension Grid -->
    <ScrollRegion>
      <StateView
        v-if="error"
        state="error"
        :error="error"
        class="h-48"
      />

      <StateView
        v-else-if="extensionsList.length === 0"
        state="empty"
        icon="icon-[mdi--puzzle-outline]"
        :title="m.extension.installed.emptyTitle"
        :description="m.extension.installed.emptyDescription"
        class="h-48"
      />

      <StateView
        v-else-if="filteredExtensions.length === 0"
        state="empty"
        icon="icon-[mdi--filter-off-outline]"
        :title="m.extension.installed.noMatchTitle"
        :description="m.extension.installed.noMatchDescription"
        class="h-48"
      />

      <template v-else>
        <div class="grid grid-cols-1 @2xl:grid-cols-2 @7xl:grid-cols-3">
          <ExtensionInstalledPanelCard
            v-for="extension in filteredExtensions"
            :key="extension.id"
            :extension="extension"
            :update-info="getUpdateInfo(extension.id)"
          />
        </div>
      </template>
    </ScrollRegion>
  </div>
</template>
