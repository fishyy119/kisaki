<!--
Extension Installed Panel renders installed extension management.
Boundary: fetches catalog and contribution snapshots for installed extensions.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { refreshExtensionContributionSnapshot } from '@renderer/core/extensions'
import { useAsyncData, useRenderState } from '@renderer/composables'
import ExtensionInstalledPanelCard from './installed-panel-card.vue'
import ExtensionInstalledPanelFilterBar from './installed-panel-filter-bar.vue'
import { useInstalledExtensionStore } from '../../stores'
import type { ExtensionUpdateInfo } from '@shared/extension'

interface Props {
  updates: ExtensionUpdateInfo[]
}

interface Emits {
  (e: 'refresh'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const store = useInstalledExtensionStore()

const {
  data: extensions,
  isLoading,
  error,
  refetch
} = useAsyncData(
  async () => {
    const [catalog] = await Promise.all([
      ipcManager.invoke('extension:get-catalog').then(unwrapIpcData),
      refreshExtensionContributionSnapshot()
    ])
    return catalog
  },
  { immediate: true }
)
const state = useRenderState(isLoading, error, extensions, { preset: 'network' })

const extensionsList = computed(() => extensions.value ?? [])

function getUpdateInfo(extensionId: string) {
  return props.updates.find((u) => u.extensionId === extensionId)
}

function handleRefresh() {
  refetch()
  emit('refresh')
}

// Filter and sort extensions
const filteredExtensions = computed(() => {
  let result = [...extensionsList.value]

  // Search filter
  if (store.searchQuery) {
    const query = store.searchQuery.toLowerCase()
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
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
    result = result.filter((p) => props.updates.some((u) => u.extensionId === p.id))
  }

  // Sort
  result.sort((a, b) => {
    let comparison = 0
    switch (store.sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'status':
        comparison = (a.enabled ? 1 : 0) - (b.enabled ? 1 : 0)
        break
      case 'hasUpdate': {
        const aHasUpdate = props.updates.some((u) => u.extensionId === a.id) ? 1 : 0
        const bHasUpdate = props.updates.some((u) => u.extensionId === b.id) ? 1 : 0
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
    <ExtensionInstalledPanelFilterBar :update-count="props.updates.length" />

    <!-- Extension Grid -->
    <div class="flex-1 overflow-auto scrollbar-thin">
      <template v-if="state === 'loading'">
        <div class="flex items-center justify-center h-48">
          <Spinner class="size-6" />
        </div>
      </template>

      <template v-else-if="extensionsList.length === 0">
        <div class="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Icon
            icon="icon-[mdi--puzzle-outline]"
            class="size-16 mb-3 opacity-30"
          />
          <p class="font-medium">暂无已安装的扩展</p>
          <p class="text-sm mt-1 text-muted-foreground/70">从"发现"页面安装扩展</p>
        </div>
      </template>

      <template v-else-if="filteredExtensions.length === 0">
        <div class="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Icon
            icon="icon-[mdi--filter-off-outline]"
            class="size-16 mb-3 opacity-30"
          />
          <p class="font-medium">没有匹配的扩展</p>
          <p class="text-sm mt-1 text-muted-foreground/70">尝试调整筛选条件</p>
        </div>
      </template>

      <template v-else>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          <ExtensionInstalledPanelCard
            v-for="extension in filteredExtensions"
            :key="extension.id"
            :extension="extension"
            :update-info="getUpdateInfo(extension.id)"
            @refresh="handleRefresh"
          />
        </div>
      </template>
    </div>
  </div>
</template>
