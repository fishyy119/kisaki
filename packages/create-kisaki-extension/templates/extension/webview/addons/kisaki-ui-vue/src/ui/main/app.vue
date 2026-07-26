<!--
Main webview document root for this extension.
Boundary: talks to the extension host only through webview RPC; state is
loaded from and saved to host storage. UI comes from @kisaki3/extension-ui-vue:
the dialog shell provides the app dialog chrome (header, close, footer) and
the components render with the app's design language on the mirrored theme.
-->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { createWebviewRpc, webview } from '@kisaki3/extension-sdk/webview'
import { Button, Field, FieldGroup, Switch, WebviewDialogShell } from '@kisaki3/extension-ui-vue'
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
  <WebviewDialogShell :title="extensionName">
    <div class="space-y-4">
      <p class="text-sm text-muted-foreground">
        This document runs inside a Kisaki webview with full Vite HMR in development.
      </p>
      <FieldGroup>
        <Field
          orientation="horizontal"
          label="Enabled"
          description="Stored in extension storage on save."
        >
          <Switch v-model="enabled" />
        </Field>
      </FieldGroup>
    </div>

    <template #footer>
      <Button
        variant="outline"
        type="button"
        @click="sendTestNotification"
      >
        Test notification
      </Button>
      <Button
        type="button"
        @click="saveAndClose"
      >
        Save and close
      </Button>
    </template>
  </WebviewDialogShell>
</template>
