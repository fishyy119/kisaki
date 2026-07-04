<!--
Extension Layout owns extension manager navigation shell.
Boundary: coordinates the extension shell and global release dialog.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { extensionDevelopmentStore } from '@renderer/core/extensions'
import { ExtensionHeader, ExtensionReleaseDialog } from '../components'

const log = createLogger('Extension')
const router = useRouter()
const releaseDialogOpen = ref(false)
const reloadingExtensionHost = ref(false)
const { hasStaleExtensions, staleCount } = extensionDevelopmentStore

async function handleInstalled() {
  await router.push({ name: 'extension-installed' })
}

async function handleReloadExtensionHost() {
  if (reloadingExtensionHost.value) {
    return
  }

  reloadingExtensionHost.value = true
  const toastId = notify.loading('正在重载扩展进程')

  try {
    unwrapIpcVoid(await ipcManager.invoke('extension:restart-host'))
    notify.update(toastId, {
      title: '扩展进程已重载',
      type: 'success',
      duration: 3000
    })
  } catch (error) {
    log.error('Failed to restart extension host:', error)
    notify.update(toastId, {
      title: '重载扩展进程失败',
      message: error instanceof Error ? error.message : String(error),
      type: 'error',
      duration: 5000
    })
  } finally {
    reloadingExtensionHost.value = false
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Page header -->
    <ExtensionHeader
      :reloading-extension-host="reloadingExtensionHost"
      :has-pending-reload="hasStaleExtensions"
      :pending-reload-count="staleCount"
      @open-release-dialog="releaseDialogOpen = true"
      @reload-extension-host="handleReloadExtensionHost"
    />

    <!-- Main content - child routes render here -->
    <div class="flex-1 min-h-0">
      <RouterView />
    </div>

    <!-- Release dialog -->
    <ExtensionReleaseDialog
      v-if="releaseDialogOpen"
      v-model:open="releaseDialogOpen"
      @applied="handleInstalled"
    />
  </div>
</template>
