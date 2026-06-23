<!--
Main webview document root for this extension.
Boundary: talks to the extension host only through webview RPC; state is
loaded from and saved to host storage.
-->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createWebviewRpc, webview } from '@kisaki3/extension-sdk/webview'
import type { HostFunctions } from '../../shared/contract'

const host = createWebviewRpc<HostFunctions>(webview)
const enabled = ref(true)

onMounted(async () => {
  const state = await host.loadState()
  enabled.value = state.enabled
})

function sendTestNotification(): void {
  void host.sendTestNotification()
}

async function saveAndClose(): Promise<void> {
  await host.saveState({ enabled: enabled.value })
  webview.close()
}
</script>

<template>
  <main class="flex min-h-screen flex-col gap-4 bg-background p-5 text-sm text-foreground">
    <p class="text-muted-foreground">
      This document runs inside a Kisaki webview with full Vite HMR in development.
    </p>
    <label class="flex items-center gap-2">
      <input
        v-model="enabled"
        type="checkbox"
        class="accent-primary"
      />
      Enabled
    </label>
    <div class="flex gap-2">
      <button
        type="button"
        class="cursor-pointer rounded-md border border-border bg-surface px-3.5 py-1.5 text-surface-foreground hover:border-primary"
        @click="sendTestNotification"
      >
        Test notification
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-md bg-primary px-3.5 py-1.5 text-primary-foreground"
        @click="saveAndClose"
      >
        Save and close
      </button>
    </div>
  </main>
</template>
