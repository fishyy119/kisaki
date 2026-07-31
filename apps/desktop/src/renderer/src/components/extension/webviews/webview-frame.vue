<!--
Extension Webview Frame hosts one webview session document in an iframe.
Boundary: bootstrap injection, ready handshake, appearance and UI locale push,
and message relay between the iframe document and main.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  WEBVIEW_BOOTSTRAP_QUERY_PARAM,
  type WebviewBootstrapPayload,
  type WebviewClientEnvelope,
  type WebviewEmbedderEnvelope
} from '@kisaki3/extension-api'
import type { ExtensionWebviewSessionInfo } from '@shared/extension'
import { Icon } from '@renderer/components/ui/icon'
import {
  closeWebview,
  notifyWebviewReady,
  postWebviewMessage,
  registerWebviewFrame,
  resolveExtensionText
} from '@renderer/core/extensions'
import { createLogger } from '@renderer/core/log'
import { uiLocale } from '@renderer/core/i18n'
import { useThemeStore } from '@renderer/stores'
import { cn } from '@renderer/utils/cn'
import { readCurrentWebviewAppearance } from './webview-theme'

const log = createLogger('Extension')

interface Props {
  session: ExtensionWebviewSessionInfo
}

const props = defineProps<Props>()

const frame = ref<HTMLIFrameElement | null>(null)
const ready = ref(false)
const themeStore = useThemeStore()
const { resolvedTheme, activeThemeId } = storeToRefs(themeStore)

// The frame itself stays transparent: the document paints its own base
// (opaque dialog slab / translucent page glass pane), and for pages the app
// light layers must transmit through the iframe canvas. Only the loading
// overlay paints — it mirrors the surface base so the pending state looks
// like the surface it will become.
const loadingClass = computed(() =>
  props.session.surface.kind === 'dialog' ? 'bg-dialog' : 'bg-background'
)

// The bootstrap snapshot is computed once per frame and then frozen: session
// fields are immutable for the session lifetime and theme updates flow
// through postMessage, so the iframe URL must never rebuild (a rebuild would
// reload the document and drop its state).
let frozenSrc: string | null = null
const src = computed(() => (frozenSrc ??= buildDocumentSrc(props.session)))
let unregisterFrame: (() => void) | null = null

// Pin both directions of the window message channel to the document origin,
// so a frame that navigated elsewhere can neither receive host messages nor
// spoof client envelopes.
const documentOrigin = computed(() => new URL(props.session.documentUrl).origin)

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
      postCurrentAppearance()
    }
  },
  { flush: 'post' }
)

watch(uiLocale, () => {
  if (ready.value) {
    postCurrentUiLocale()
  }
})

function buildDocumentSrc(session: ExtensionWebviewSessionInfo): string {
  const bootstrap: WebviewBootstrapPayload = {
    webviewId: session.webviewId,
    extensionId: session.extensionId,
    params: session.params,
    surface: session.surface.kind,
    appearance: readCurrentWebviewAppearance(resolvedTheme.value),
    uiLocale: uiLocale.value
  }
  const url = new URL(session.documentUrl)
  url.searchParams.set(WEBVIEW_BOOTSTRAP_QUERY_PARAM, JSON.stringify(bootstrap))
  return url.toString()
}

function handleWindowMessage(event: MessageEvent): void {
  if (!frame.value || event.source !== frame.value.contentWindow) {
    return
  }

  if (event.origin !== documentOrigin.value) {
    return
  }

  const envelope = toClientEnvelope(event.data)
  if (!envelope || envelope.webviewId !== props.session.webviewId) {
    return
  }

  switch (envelope.type) {
    case 'kisaki-webview:ready':
      ready.value = true
      postCurrentAppearance()
      postCurrentUiLocale()
      void notifyWebviewReady(props.session.webviewId).catch((error) => {
        log.error('Failed to acknowledge webview readiness:', error)
      })
      return
    case 'kisaki-webview:message':
      void postWebviewMessage(props.session.webviewId, envelope.message).catch((error) => {
        log.error('Failed to forward webview message:', error)
      })
      return
    case 'kisaki-webview:close':
      void closeWebview(props.session.webviewId).catch((error) => {
        log.error('Failed to close webview session:', error)
      })
  }
}

function toClientEnvelope(value: unknown): WebviewClientEnvelope | null {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as { type?: unknown }).type !== 'string' ||
    typeof (value as { webviewId?: unknown }).webviewId !== 'string'
  ) {
    return null
  }

  return (value as { type: string }).type.startsWith('kisaki-webview:')
    ? (value as WebviewClientEnvelope)
    : null
}

function postToFrame(envelope: WebviewEmbedderEnvelope): void {
  frame.value?.contentWindow?.postMessage(envelope, documentOrigin.value)
}

function postCurrentAppearance(): void {
  postToFrame({
    type: 'kisaki-webview:appearance',
    appearance: readCurrentWebviewAppearance(resolvedTheme.value)
  })
}

function postCurrentUiLocale(): void {
  postToFrame({
    type: 'kisaki-webview:ui-locale',
    uiLocale: uiLocale.value
  })
}
</script>

<template>
  <div class="relative size-full">
    <iframe
      ref="frame"
      :src="src"
      :title="resolveExtensionText(props.session.title)"
      class="size-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms"
    />
    <div
      v-if="!ready"
      :class="cn('absolute inset-0 flex items-center justify-center', loadingClass)"
    >
      <Icon
        icon="icon-[mdi--loading]"
        class="size-5 animate-spin text-muted-foreground"
      />
    </div>
  </div>
</template>
