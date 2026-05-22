<!--
Extension Installed Panel renders installed extension management.
Boundary: owns installed extension list, update checks, and update actions.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Spinner } from '@renderer/components/ui/spinner'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { refreshExtensionContributionSnapshot } from '@renderer/core/extensions'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useAsyncData, useRenderState } from '@renderer/composables'
import ExtensionInstalledPanelCard from './installed-panel-card.vue'
import ExtensionInstalledPanelFilterBar from './installed-panel-filter-bar.vue'
import { useInstalledExtensionStore } from '../../stores'
import type { ExtensionUpdateAllResult, ExtensionUpdateCheckResult } from '@shared/extension'

const log = createLogger('Extension')

const store = useInstalledExtensionStore()
const updateCheck = ref<ExtensionUpdateCheckResult>({ updates: [], unavailable: [] })
const checkingUpdates = ref(false)
const updatingAll = ref(false)
const updateAllResultDialogOpen = ref(false)
const updateAllResults = ref<readonly ExtensionUpdateAllResult[]>([])

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
const automaticUpdateCount = computed(() =>
  updates.value.filter((update) => update.automatic).length
)
const updateAllResultSummary = computed(() => {
  const successes = updateAllResults.value.filter((result) => result.success)
  const failures = updateAllResults.value.filter((result) => !result.success)
  return createUpdateAllSummary(successes, failures)
})

let unsubscribeInstallationsChanged: (() => void) | null = null

onMounted(() => {
  unsubscribeInstallationsChanged = ipcManager.on('extension:installations-changed', () => {
    void refreshInstalledCatalog()
  })
})

onUnmounted(() => {
  unsubscribeInstallationsChanged?.()
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
    updateCheck.value = unwrapIpcData(await ipcManager.invoke('extension:check-updates'))
  } catch (error) {
    log.error('Failed to check updates:', error)
  } finally {
    checkingUpdates.value = false
  }
}

async function handleUpdateAll() {
  updatingAll.value = true
  try {
    const results = unwrapIpcData(await ipcManager.invoke('extension:update-all'))
    await refreshExtensionContributionSnapshot()
    await refetch()
    updateCheck.value = unwrapIpcData(await ipcManager.invoke('extension:check-updates'))
    updateAllResults.value = results
    updateAllResultDialogOpen.value = results.length > 0
    showUpdateAllResult(results)
  } catch (error) {
    notify.error('批量更新失败', error instanceof Error ? error.message : String(error))
  } finally {
    updatingAll.value = false
  }
}

function resetUpdateCheck() {
  updateCheck.value = { updates: [], unavailable: [] }
}

function showUpdateAllResult(results: readonly ExtensionUpdateAllResult[]): void {
  if (results.length === 0) {
    notify.info('没有可自动更新的扩展')
    return
  }

  const successes = results.filter((result) => result.success)
  const failures = results.filter((result) => !result.success)
  const summary = createUpdateAllSummary(successes, failures)

  if (failures.length === 0) {
    notify.success('批量更新完成', summary)
    return
  }

  if (successes.length > 0) {
    notify.error('部分更新失败', summary)
    return
  }

  notify.error('批量更新失败', summary)
}

function createUpdateAllSummary(
  successes: readonly ExtensionUpdateAllResult[],
  failures: readonly ExtensionUpdateAllResult[]
): string {
  const parts: string[] = []
  if (successes.length > 0) {
    parts.push(`${successes.length} 个成功`)
  }
  if (failures.length > 0) {
    const failedNames = failures
      .slice(0, 2)
      .map((result) => `${result.extensionId}: ${result.error ?? '未知错误'}`)
      .join('；')
    parts.push(`${failures.length} 个失败${failedNames ? `：${failedNames}` : ''}`)
  }

  return parts.join('，')
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
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Filter Bar -->
    <ExtensionInstalledPanelFilterBar
      :update-count="updates.length"
      :checking-updates="checkingUpdates"
      :updating-all="updatingAll"
      :automatic-update-count="automaticUpdateCount"
      @check-updates="handleCheckUpdates"
      @update-all="handleUpdateAll"
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

    <Dialog v-model:open="updateAllResultDialogOpen">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>批量更新结果</DialogTitle>
          <DialogDescription>{{ updateAllResultSummary }}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div class="max-h-80 overflow-auto rounded-md border border-border">
            <div
              v-for="result in updateAllResults"
              :key="result.extensionId"
              class="flex items-start gap-3 border-b border-border px-3 py-2 last:border-b-0"
            >
              <Icon
                :icon="
                  result.success
                    ? 'icon-[mdi--check-circle-outline]'
                    : 'icon-[mdi--alert-circle-outline]'
                "
                :class="result.success ? 'size-4 text-success' : 'size-4 text-destructive'"
              />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="truncate text-sm font-medium">{{ result.extensionId }}</span>
                  <Badge :variant="result.success ? 'success' : 'destructive'">
                    {{ result.success ? '成功' : '失败' }}
                  </Badge>
                </div>
                <div class="mt-1 text-xs text-muted-foreground">
                  v{{ result.currentVersion }} -> v{{ result.targetVersion }}
                </div>
                <div
                  v-if="result.error"
                  class="mt-1 break-words text-xs text-destructive"
                >
                  {{ result.error }}
                </div>
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button @click="updateAllResultDialogOpen = false">完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
