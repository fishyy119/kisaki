<script setup lang="ts">
/**
 * Plugin Installed Page
 *
 * Installed plugin management page.
 */

import { PluginInstalledPanel } from '../components'
import type { ExtensionUpdateInfo } from '@shared/extension'

interface Props {
  updates: ExtensionUpdateInfo[]
  refreshKey: number
  onRefresh: () => void
}

const props = defineProps<Props>()
</script>

<template>
  <div class="h-full">
    <PluginInstalledPanel
      :key="props.refreshKey"
      :updates="props.updates"
      @refresh="props.onRefresh"
    />
  </div>
</template>
