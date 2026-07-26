<!--
Main webview document root for this extension.
Boundary: talks to the extension host only through webview RPC; state is
loaded from and saved to host storage. The host draws no chrome inside the
webview, so this document owns its dialog header, footer, and close button.
-->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createWebviewRpc, webview } from '@kisaki3/extension-sdk/webview'
import type { HostFunctions } from '../../shared/contract'

const extensionName = `{{EXTENSION_NAME}}`

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
  <div class="flex h-screen flex-col text-sm text-foreground">
    <header class="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
      <h1 class="min-w-0 flex-1 truncate font-medium">{{ extensionName }}</h1>
      <button
        type="button"
        aria-label="Close"
        class="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        @click="webview.close()"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-4"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </header>

    <main class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
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
    </main>

    <footer class="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
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
    </footer>
  </div>
</template>
