<!--
Extension Webview Frame hosts one webview session document in an iframe.
Boundary: bootstrap injection, ready handshake, theme push, and message relay
between the iframe document and main.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  WEBVIEW_BOOTSTRAP_QUERY_PARAM,
  type WebviewBootstrapPayload,
  type WebviewClientMessage,
  type WebviewEmbedderMessage
} from '@kisaki3/extension-api'
import type { ExtensionWebviewSessionInfo } from '@shared/extension'
import { Icon } from '@renderer/components/ui/icon'
import {
  closeWebview,
  notifyWebviewReady,
  postWebviewMessage,
  registerWebviewFrame
} from '@renderer/core/extensions'
import { createLogger } from '@renderer/core/log'
import { useThemeStore } from '@renderer/stores'
import { readCurrentWebviewTheme } from './webview-theme'

const log = createLogger('Extension')

interface Props {
  session: ExtensionWebviewSessionInfo
}

const props = defineProps<Props>()

const frame = ref<HTMLIFrameElement | null>(null)
const ready = ref(false)
const themeStore = useThemeStore()
const { resolvedTheme, activeThemeId } = storeToRefs(themeStore)

// The bootstrap snapshot is computed once per frame and then frozen: session
// fields are immutable for the session lifetime and theme updates flow
// through postMessage, so the iframe URL must never rebuild (a rebuild would
// reload the document and drop its state).
let frozenSrc: string | null = null
const src = computed(() => (frozenSrc ??= buildDocumentSrc(props.session)))
let unregisterFrame: (() => void) | null = null

onMounted(() => {
  window.addEventListener('message', handleWindowMessage)
  unregisterFrame = registerWebviewFrame(props.session.webviewId, (message) => {
    postToFrame({ type: 'kisaki-webview:message', message })
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleWindowMessage)
  unregisterFrame?.()
  unregisterFrame = null
})

watch(
  [resolvedTheme, activeThemeId],
  () => {
    if (ready.value) {
      postCurrentTheme()
    }
  },
  { flush: 'post' }
)

function buildDocumentSrc(session: ExtensionWebviewSessionInfo): string {
  const bootstrap: WebviewBootstrapPayload = {
    webviewId: session.webviewId,
    extensionId: session.extensionId,
    params: session.params,
    theme: readCurrentWebviewTheme(resolvedTheme.value)
  }
  const url = new URL(session.documentUrl)
  url.searchParams.set(WEBVIEW_BOOTSTRAP_QUERY_PARAM, JSON.stringify(bootstrap))
  return url.toString()
}

function handleWindowMessage(event: MessageEvent): void {
  if (!frame.value || event.source !== frame.value.contentWindow) {
    return
  }

  const message = toClientMessage(event.data)
  if (!message || message.webviewId !== props.session.webviewId) {
    return
  }

  switch (message.type) {
    case 'kisaki-webview:ready':
      ready.value = true
      postCurrentTheme()
      void notifyWebviewReady(props.session.webviewId).catch((error) => {
        log.error('Failed to acknowledge webview readiness:', error)
      })
      return
    case 'kisaki-webview:message':
      void postWebviewMessage(props.session.webviewId, message.message).catch((error) => {
        log.error('Failed to forward webview message:', error)
      })
      return
    case 'kisaki-webview:close':
      void closeWebview(props.session.webviewId).catch((error) => {
        log.error('Failed to close webview session:', error)
      })
  }
}

function toClientMessage(value: unknown): WebviewClientMessage | null {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as { type?: unknown }).type !== 'string' ||
    typeof (value as { webviewId?: unknown }).webviewId !== 'string'
  ) {
    return null
  }

  return (value as { type: string }).type.startsWith('kisaki-webview:')
    ? (value as WebviewClientMessage)
    : null
}

function postToFrame(message: WebviewEmbedderMessage): void {
  frame.value?.contentWindow?.postMessage(message, '*')
}

function postCurrentTheme(): void {
  postToFrame({ type: 'kisaki-webview:theme', theme: readCurrentWebviewTheme(resolvedTheme.value) })
}
</script>

<template>
  <div class="relative size-full bg-background">
    <iframe
      ref="frame"
      :src="src"
      :title="props.session.title"
      class="size-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms"
    />
    <div
      v-if="!ready"
      class="absolute inset-0 flex items-center justify-center bg-background"
    >
      <Icon
        icon="icon-[mdi--loading]"
        class="size-5 animate-spin text-muted-foreground"
      />
    </div>
  </div>
</template>
