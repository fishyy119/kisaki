<!--
Extension Layout owns extension manager navigation shell.
Boundary: coordinates the extension shell and global release dialog.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { extensionDevelopmentStore, reloadExtensionHost } from '@renderer/core/extensions'
import { ExtensionHeader, ExtensionReleaseDialog } from '../components'

const router = useRouter()
const releaseDialogOpen = ref(false)
const { hasStaleExtensions, staleCount, reloadingHost } = extensionDevelopmentStore

async function handleInstalled() {
  await router.push({ name: 'extension-installed' })
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Page header -->
    <ExtensionHeader
      :reloading-extension-host="reloadingHost"
      :has-pending-reload="hasStaleExtensions"
      :pending-reload-count="staleCount"
      @open-release-dialog="releaseDialogOpen = true"
      @reload-extension-host="reloadExtensionHost"
    />

    <!-- Main content - child routes render here -->
    <div class="flex-1 min-h-0 bg-background">
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
