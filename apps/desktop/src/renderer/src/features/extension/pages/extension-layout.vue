<!--
Extension Layout owns extension manager navigation shell.
Boundary: coordinates the extension shell and global install dialog.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { ExtensionHeader, ExtensionInstallDialog } from '../components'

const log = createLogger('Extension')
const router = useRouter()
const installDialogOpen = ref(false)
const reloadingExtensionHost = ref(false)

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
      @open-install-dialog="installDialogOpen = true"
      @reload-extension-host="handleReloadExtensionHost"
    />

    <!-- Main content - child routes render here -->
    <div class="flex-1 min-h-0">
      <RouterView />
    </div>

    <!-- Install dialog -->
    <ExtensionInstallDialog
      v-if="installDialogOpen"
      v-model:open="installDialogOpen"
      @installed="handleInstalled"
    />
  </div>
</template>
