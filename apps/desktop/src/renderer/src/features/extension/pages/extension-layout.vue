<!--
Extension Layout owns extension manager navigation shell.
Boundary: coordinates updates and install dialog state for child routes.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { refreshExtensionContributionSnapshot } from '@renderer/core/extensions'
import { Icon } from '@renderer/components/ui/icon'
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
import { ExtensionHeader } from '../components'
import { ExtensionInstallDialog } from '../components'
import type { ExtensionUpdateAllResult, ExtensionUpdateCheckResult } from '@shared/extension'

const router = useRouter()
const route = useRoute()

const isInstalledRoute = computed(() => route.name === 'extension-installed')

const updateCheck = ref<ExtensionUpdateCheckResult>({ updates: [], unavailable: [] })
const checkingUpdates = ref(false)
const updatingAll = ref(false)
const refreshKey = ref(0)
const installDialogOpen = ref(false)
const updateAllResultDialogOpen = ref(false)
const updateAllResults = ref<readonly ExtensionUpdateAllResult[]>([])
const automaticUpdateCount = computed(
  () => updateCheck.value.updates.filter((update) => update.automatic).length
)
const updateAllResultSummary = computed(() => {
  const successes = updateAllResults.value.filter((result) => result.success)
  const failures = updateAllResults.value.filter((result) => !result.success)
  return createUpdateAllSummary(successes, failures)
})

async function handleCheckUpdates() {
  checkingUpdates.value = true
  try {
    updateCheck.value = unwrapIpcData(await ipcManager.invoke('extension:check-updates'))
  } catch (error) {
    console.error('Failed to check updates:', error)
  } finally {
    checkingUpdates.value = false
  }
}

function handleRefresh() {
  refreshKey.value++
  updateCheck.value = { updates: [], unavailable: [] }
}

async function handleUpdateAll() {
  updatingAll.value = true
  try {
    const results = unwrapIpcData(await ipcManager.invoke('extension:update-all'))
    await refreshExtensionContributionSnapshot()
    refreshKey.value++
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

async function handleInstalled() {
  // Refresh installed list and switch to installed page
  refreshKey.value++
  await router.push({ name: 'extension-installed' })
}

const installedPageProps = computed(() => ({
  updates: updateCheck.value.updates,
  refreshKey: refreshKey.value,
  onRefresh: handleRefresh
}))

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
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Page header -->
    <ExtensionHeader
      :checking-updates="checkingUpdates"
      :updating-all="updatingAll"
      :update-count="updateCheck.updates.length"
      :automatic-update-count="automaticUpdateCount"
      @check-updates="handleCheckUpdates"
      @update-all="handleUpdateAll"
      @open-install-dialog="installDialogOpen = true"
    />

    <!-- Main content - child routes render here -->
    <div class="flex-1 min-h-0">
      <RouterView v-slot="{ Component }">
        <component
          :is="Component"
          v-bind="isInstalledRoute ? installedPageProps : {}"
        />
      </RouterView>
    </div>

    <!-- Install dialog -->
    <ExtensionInstallDialog
      v-if="installDialogOpen"
      v-model:open="installDialogOpen"
      @installed="handleInstalled"
    />

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
                  result.success ? 'icon-[mdi--check-circle-outline]' : 'icon-[mdi--alert-circle-outline]'
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
