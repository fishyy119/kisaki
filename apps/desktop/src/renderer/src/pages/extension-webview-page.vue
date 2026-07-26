<!--
Extension Webview Page renders one page-surface webview session full-page.
The page is a pure container: the document owns all chrome, and the app
titlebar and sidebar stay as the host-owned escape hatch.
Boundary: route-bound session lifetime; leaving the route closes the session.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ExtensionWebviewFrame } from '@renderer/components/extension/webview-host'
import { closeWebview, getExtensionWebviewSession } from '@renderer/core/extensions'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const log = createLogger('Extension')

const { m } = useI18n()

interface Props {
  webviewId: string
}

const props = defineProps<Props>()

const session = computed(() => getExtensionWebviewSession(props.webviewId))

onBeforeRouteLeave(() => {
  if (!getExtensionWebviewSession(props.webviewId)) {
    return
  }

  void closeWebview(props.webviewId).catch((error) => {
    log.error('Failed to close webview session:', error)
  })
})
</script>

<template>
  <div class="h-full">
    <ExtensionWebviewFrame
      v-if="session"
      :key="session.webviewId"
      :session="session"
    />
    <div
      v-else
      class="flex items-center justify-center h-full bg-background text-sm text-muted-foreground"
    >
      {{ m.extension.webviewPageClosed }}
    </div>
  </div>
</template>
