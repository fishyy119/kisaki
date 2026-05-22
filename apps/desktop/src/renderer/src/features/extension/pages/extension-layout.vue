<!--
Extension Layout owns extension manager navigation shell.
Boundary: coordinates the extension shell and global install dialog.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ExtensionHeader, ExtensionInstallDialog } from '../components'

const router = useRouter()
const installDialogOpen = ref(false)

async function handleInstalled() {
  await router.push({ name: 'extension-installed' })
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Page header -->
    <ExtensionHeader
      @open-install-dialog="installDialogOpen = true"
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
