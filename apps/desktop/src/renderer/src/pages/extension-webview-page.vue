<!--
Extension Webview Page renders one page-surface webview session full-page.
Boundary: route-bound session lifetime; leaving the route closes the session.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { ExtensionWebviewFrame } from '@renderer/components/extension/webview-host'
import {
  closeWebview,
  getExtensionWebviewSession,
  leaveExtensionWebviewPage
} from '@renderer/core/extensions'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Extension')

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
  <div class="flex flex-col h-full bg-background">
    <header class="flex items-center gap-2 h-12 px-3 border-b border-border shrink-0">
      <Button
        size="icon-sm"
        variant="ghost"
        @click="leaveExtensionWebviewPage"
      >
        <Icon
          icon="icon-[mdi--arrow-left]"
          class="size-4"
        />
      </Button>
      <h1 class="text-sm font-medium truncate">{{ session?.title ?? '' }}</h1>
      <span
        v-if="session"
        class="text-xs text-muted-foreground truncate"
      >
        {{ session.extensionName }}
      </span>
    </header>
    <div class="flex-1 min-h-0">
      <ExtensionWebviewFrame
        v-if="session"
        :key="session.webviewId"
        :session="session"
      />
      <div
        v-else
        class="flex items-center justify-center h-full text-sm text-muted-foreground"
      >
        该扩展页面已关闭
      </div>
    </div>
  </div>
</template>
