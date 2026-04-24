<script setup lang="ts">
/**
 * Plugin Layout
 *
 * Parent layout component for plugin marketplace feature.
 * Provides header + RouterView for child pages and hosts the install dialog.
 */

import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { checkExtensionUpdates } from '@renderer/core/extensions'
import { PluginHeader } from '../components'
import { PluginInstallDialog } from '../components'
import type { ExtensionUpdateInfo } from '@shared/extension'

const router = useRouter()
const route = useRoute()

const isInstalledRoute = computed(() => route.name === 'plugin-installed')

const updates = ref<ExtensionUpdateInfo[]>([])
const checkingUpdates = ref(false)
const refreshKey = ref(0)
const installDialogOpen = ref(false)

async function handleCheckUpdates() {
  checkingUpdates.value = true
  try {
    updates.value = await checkExtensionUpdates()
  } catch (error) {
    console.error('Failed to check updates:', error)
  } finally {
    checkingUpdates.value = false
  }
}

function handleRefresh() {
  refreshKey.value++
  // Clear update for refreshed plugin
  updates.value = []
}

async function handleInstalled() {
  // Refresh installed list and switch to installed page
  refreshKey.value++
  await router.push({ name: 'plugin-installed' })
}

const installedPageProps = computed(() => ({
  updates: updates.value,
  refreshKey: refreshKey.value,
  onRefresh: handleRefresh
}))
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Page header -->
    <PluginHeader
      :checking-updates="checkingUpdates"
      :update-count="updates.length"
      @check-updates="handleCheckUpdates"
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
    <PluginInstallDialog
      v-if="installDialogOpen"
      v-model:open="installDialogOpen"
      @installed="handleInstalled"
    />
  </div>
</template>
