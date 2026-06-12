<!--
Extension Webview Dialog Host renders every dialog-surface webview session.
Boundary: global data-driven projection of main-owned sessions; the app draws
minimal chrome (title and close) so closing never depends on the webview.
-->
<script setup lang="ts">
import type { WebviewDialogSize } from '@kisaki3/extension-api'
import type { ExtensionWebviewSessionInfo } from '@shared/extension'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { closeWebview, extensionWebviewStore } from '@renderer/core/extensions'
import { createLogger } from '@renderer/core/log'
import { cn } from '@renderer/utils'
import ExtensionWebviewFrame from './webview-frame.vue'

const log = createLogger('Extension')

const dialogSessions = extensionWebviewStore.dialogSessions

const DIALOG_SIZE_CLASSES: Record<WebviewDialogSize, { width: string; height: string }> = {
  sm: { width: 'max-w-xl', height: 'h-[50vh]' },
  md: { width: 'max-w-2xl', height: 'h-[60vh]' },
  lg: { width: 'max-w-4xl', height: 'h-[70vh]' },
  xl: { width: 'max-w-5xl', height: 'h-[76vh]' },
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
      :class="cn(DIALOG_SIZE_CLASSES[getDialogSize(session)].width, 'flex flex-col gap-0 p-0')"
    >
      <DialogHeader class="pr-9">
        <DialogTitle class="text-sm truncate">{{ session.title }}</DialogTitle>
      </DialogHeader>
      <div :class="cn('min-h-0 rounded-b-md overflow-hidden', DIALOG_SIZE_CLASSES[getDialogSize(session)].height)">
        <ExtensionWebviewFrame :session="session" />
      </div>
    </DialogContent>
  </Dialog>
</template>
