<!--
Extension Installed Page hosts installed extension management.
Boundary: receives refresh props from the extension layout.
-->
<script setup lang="ts">
import { ExtensionInstalledPanel } from '../components'
import type { ExtensionUpdateInfo } from '@shared/extension'

interface Props {
  updates: readonly ExtensionUpdateInfo[]
  refreshKey: number
  onRefresh: () => void
}

const props = defineProps<Props>()
</script>

<template>
  <div class="h-full">
    <ExtensionInstalledPanel
      :key="props.refreshKey"
      :updates="props.updates"
      @refresh="props.onRefresh"
    />
  </div>
</template>
