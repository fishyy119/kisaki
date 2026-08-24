<!--
Extension Page renders one declared webview page full-page under its stable
`/extension-page/:extensionId/:pageId` route. The page is a pure container:
the document owns all chrome, and the app titlebar and sidebar stay as the
host-owned escape hatch.
Boundary: route-bound session lifetime. Entering adopts the live session of
the declared page or opens a fresh one; leaving (or switching to another
page) closes it; external closes leave the route through the webview
navigation binding.
-->
<script setup lang="ts">
import { computed, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { ExtensionWebviewFrame } from '@renderer/components/extension/webviews'
import { StateView } from '@renderer/components/ui/state-view'
import {
  closeWebview,
  findExtensionPageSession,
  openExtensionWebviewPage
} from '@renderer/core/extensions'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const log = createLogger('Extension')

const { m } = useI18n()

interface Props {
  extensionId: string
  pageId: string
}

const props = defineProps<Props>()

const session = computed(() => findExtensionPageSession(props.extensionId, props.pageId))

watch(
  () => [props.extensionId, props.pageId] as const,
  ([extensionId, pageId]) => {
    if (findExtensionPageSession(extensionId, pageId)) {
      return
    }

    void openExtensionWebviewPage(extensionId, pageId).catch((error) => {
      log.error('Failed to open webview page session:', error)
    })
  },
  { immediate: true }
)

onBeforeRouteUpdate((to) => {
  if (to.params.extensionId !== props.extensionId || to.params.pageId !== props.pageId) {
    closeCurrentSession()
  }
})

onBeforeRouteLeave(() => {
  closeCurrentSession()
})

function closeCurrentSession(): void {
  const current = findExtensionPageSession(props.extensionId, props.pageId)
  if (!current) {
    return
  }

  void closeWebview(current.webviewId).catch((error) => {
    log.error('Failed to close webview session:', error)
  })
}
</script>

<template>
  <div class="h-full">
    <ExtensionWebviewFrame
      v-if="session"
      :key="session.webviewId"
      :session="session"
    />
    <StateView
      v-else
      state="empty"
      :description="m.extension.webviewPageClosed"
      class="h-full bg-background"
    />
  </div>
</template>
