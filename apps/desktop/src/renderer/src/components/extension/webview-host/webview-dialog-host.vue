<!--
Extension Webview Dialog Host renders every dialog-surface webview session.
Boundary: global data-driven projection of main-owned sessions. The host owns
only the modal window (overlay, positioning, sizing, slab); the document owns
all chrome inside it. Dismissal matches app dialogs: Esc closes (host-side
while the loading overlay holds focus, SDK-side once the document runs) and
outside clicks never close, protecting form state from stray clicks.
-->
<script setup lang="ts">
import type { WebviewDialogSize } from '@kisaki3/extension-api'
import type { ExtensionWebviewSessionInfo } from '@shared/extension'
import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import { closeWebview, extensionWebviewStore } from '@renderer/core/extensions'
import { createLogger } from '@renderer/core/log'
import { cn } from '@renderer/utils/cn'
import ExtensionWebviewFrame from './webview-frame.vue'

const log = createLogger('Extension')

const dialogSessions = extensionWebviewStore.dialogSessions

const DIALOG_SIZE_CLASSES: Record<WebviewDialogSize, { width: string; height: string }> = {
  sm: { width: 'max-w-xl', height: 'h-[50vh]' },
  md: { width: 'max-w-2xl', height: 'h-[60vh]' },
  lg: { width: 'max-w-4xl', height: 'h-[70vh]' },
  xl: { width: 'max-w-5xl', height: 'h-[76vh]' },
  '2xl': { width: 'max-w-6xl', height: 'h-[82vh]' },
  full: { width: 'max-w-[92vw]', height: 'h-[84vh]' }
}

function getDialogSize(session: ExtensionWebviewSessionInfo): WebviewDialogSize {
  return session.surface.kind === 'dialog' ? (session.surface.size ?? 'md') : 'md'
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
      :class="
        cn(
          DIALOG_SIZE_CLASSES[getDialogSize(session)].width,
          DIALOG_SIZE_CLASSES[getDialogSize(session)].height,
          'overflow-hidden'
        )
      "
      :show-close-button="false"
    >
      <!-- The visible title lives inside the document; this one carries the
           accessible dialog name across the iframe boundary. -->
      <DialogTitle class="sr-only">{{ session.title }}</DialogTitle>
      <ExtensionWebviewFrame :session="session" />
    </DialogContent>
  </Dialog>
</template>
