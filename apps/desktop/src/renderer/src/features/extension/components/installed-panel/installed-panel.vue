<!--
Extension Installed Panel renders installed extension management.
Boundary: owns installed extension list, update checks, and update actions.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { refreshExtensionContributionSnapshot } from '@renderer/core/extensions'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useAsyncData, useRenderState } from '@renderer/composables'
import ExtensionInstalledPanelCard from './installed-panel-card.vue'
import ExtensionInstalledPanelFilterBar from './installed-panel-filter-bar.vue'
import { useInstalledExtensionStore } from '../../stores'
import type {
  ExtensionAutomaticUpdateRunState,
  ExtensionUpdateCheckResult
} from '@shared/extension'

const log = createLogger('Extension')

const store = useInstalledExtensionStore()
const updateCheck = ref<ExtensionUpdateCheckResult>({ updates: [], unavailable: [] })
const automaticUpdateRun = ref<ExtensionAutomaticUpdateRunState>(createIdleAutomaticUpdateRun())
const checkingUpdates = ref(false)

const {
  data: extensions,
  isLoading,
  error,
  refetch
} = useAsyncData(
  async () => {
    const [catalog] = await Promise.all([
      ipcManager.invoke('extension:get-installed-packages').then(unwrapIpcData),
      refreshExtensionContributionSnapshot()
    ])
    return catalog
  },
  { immediate: true }
)
const state = useRenderState(isLoading, error, extensions, { preset: 'network' })

const extensionsList = computed(() => extensions.value ?? [])
const updates = computed(() => updateCheck.value.updates)

let unsubscribeInstallationsChanged: (() => void) | null = null
let unsubscribeAutomaticUpdateRunChanged: (() => void) | null = null

onMounted(() => {
  unsubscribeInstallationsChanged = ipcManager.on('extension:installations-changed', () => {
    void refreshInstalledCatalog()
  })
  unsubscribeAutomaticUpdateRunChanged = ipcManager.on(
    'extension:automatic-update-run-changed',
    (_event, state) => {
      automaticUpdateRun.value = state
    }
  )
  void refreshAutomaticUpdateRun()
})

onUnmounted(() => {
  unsubscribeInstallationsChanged?.()
  unsubscribeAutomaticUpdateRunChanged?.()
})

function getUpdateInfo(extensionId: string) {
  return updates.value.find((u) => u.extensionId === extensionId)
}

async function refreshInstalledCatalog() {
  resetUpdateCheck()
  await refetch()
}

async function handleRefresh() {
  await refreshInstalledCatalog()
}

async function handleCheckUpdates() {
  checkingUpdates.value = true
  try {
    const result = unwrapIpcData(await ipcManager.invoke('extension:check-updates'))
    updateCheck.value = result
    if (result.updates.length > 0) {
      notify.info('发现可用更新', `${result.updates.length} 个扩展可以更新`)
    } else {
      notify.info('暂无可用更新')
    }
  } catch (error) {
    log.error('Failed to check updates:', error)
    notify.error('检查更新失败', error instanceof Error ? error.message : String(error))
  } finally {
    checkingUpdates.value = false
  }
}

async function refreshAutomaticUpdateRun() {
  try {
    automaticUpdateRun.value = unwrapIpcData(
      await ipcManager.invoke('extension:get-automatic-update-run')
    )
  } catch (error) {
    log.error('Failed to load automatic update state:', error)
  }
}

function resetUpdateCheck() {
  updateCheck.value = { updates: [], unavailable: [] }
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
    result = result.filter((p) => updates.value.some((u) => u.extensionId === p.id))
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

function createIdleAutomaticUpdateRun(): ExtensionAutomaticUpdateRunState {
  return {
    status: 'idle',
    trigger: 'startup',
    startedAt: null,
    finishedAt: null,
    results: []
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Filter Bar -->
    <ExtensionInstalledPanelFilterBar
      :update-count="updates.length"
      :checking-updates="checkingUpdates"
      :automatic-update-run="automaticUpdateRun"
      @check-updates="handleCheckUpdates"
    />

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
          <p class="text-sm mt-1 text-muted-foreground/70">从“发现”页面安装扩展</p>
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
