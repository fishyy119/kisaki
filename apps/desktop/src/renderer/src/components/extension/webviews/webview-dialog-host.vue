<!--
Extension Webview Dialog Host renders every dialog-surface webview session.
Boundary: global data-driven projection of main-owned sessions. The host owns
only the modal window (positioning, sizing, slab); the document owns all
chrome inside it. The declared size is the app's dialog width step, and every
webview dialog fills its height so the document lays out against a definite
box. Dismissal matches app dialogs: Esc closes (host-side while the loading
overlay holds focus, SDK-side once the document runs) and outside clicks never
close, protecting form state from stray clicks.
-->
<script setup lang="ts">
import type { WebviewDialogSize } from '@kisaki3/extension-api'
import type { ExtensionWebviewSessionInfo } from '@shared/extension'
import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import {
  closeWebview,
  extensionWebviewStore,
  resolveExtensionText
} from '@renderer/core/extensions'
import { createLogger } from '@renderer/core/log'
import ExtensionWebviewFrame from './webview-frame.vue'

const log = createLogger('Extension')

const dialogSessions = extensionWebviewStore.dialogSessions

function getDialogSize(session: ExtensionWebviewSessionInfo): WebviewDialogSize {
  return session.surface.kind === 'dialog' ? session.surface.size : 'md'
}

function handleOpenChange(session: ExtensionWebviewSessionInfo, open: boolean): void {
  if (open) {
    return
  }

  void closeWebview(session.webviewId).catch((error) => {
    log.error('Failed to close webview session:', error)
  })
}
</script>

<template>
  <Dialog
    v-for="session in dialogSessions"
    :key="session.webviewId"
    open
    @update:open="(open) => handleOpenChange(session, open)"
  >
    <DialogContent
      :size="getDialogSize(session)"
      fill
      class="overflow-hidden"
      :show-close-button="false"
    >
      <!-- The visible title lives inside the document; this one carries the
           accessible dialog name across the iframe boundary. -->
      <DialogTitle class="sr-only">{{ resolveExtensionText(session.title) }}</DialogTitle>
      <ExtensionWebviewFrame :session="session" />
    </DialogContent>
  </Dialog>
</template>
