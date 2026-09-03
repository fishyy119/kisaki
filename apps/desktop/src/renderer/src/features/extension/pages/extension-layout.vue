<!--
Extension Layout owns extension manager navigation shell.
Boundary: coordinates the extension shell and global release dialog.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { extensionDevelopmentStore, reloadExtensionHost } from '@renderer/core/extensions'
import { ExtensionHeader, ExtensionReleaseDialog } from '../components'
import { EXTENSION_ROUTE_NAMES } from '../routes'

const route = useRoute()
const router = useRouter()
const releaseDialogOpen = ref(false)
const { hasStaleExtensions, staleCount, reloadingHost } = extensionDevelopmentStore

async function handleInstalled() {
  await router.push({ name: EXTENSION_ROUTE_NAMES.installed })
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

    <!-- Main content - child routes render here, one page instance per location -->
    <div class="flex-1 min-h-0 bg-background">
      <RouterView :key="route.path" />
    </div>

    <!-- Release dialog -->
    <ExtensionReleaseDialog
      v-if="releaseDialogOpen"
      v-model:open="releaseDialogOpen"
      @applied="handleInstalled"
    />
  </div>
</template>
