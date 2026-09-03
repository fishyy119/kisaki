<!--
Webview Dialog Shell is the document scaffold for dialog-surface webviews:
the app dialog anatomy (header with title and close, scrollable body,
optional footer) rendered as the document root. The host draws only the
modal window around the document; this shell provides the chrome inside it,
with the close button wired to the webview session.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { webview } from '@kisaki3/extension-sdk/webview'
import { cn } from '../../utils/cn'
import DialogCloseButton from '../dialog/dialog-close-button.vue'
import DialogFooter from '../dialog/dialog-footer.vue'
import DialogHeader from '../dialog/dialog-header.vue'

const props = withDefaults(
  defineProps<{
    /** Visible dialog title; replace the whole strip with the header slot. */
    title?: string
    showCloseButton?: boolean
    class?: HTMLAttributes['class']
    /** Class of the scrollable body region, e.g. `p-0` for full-bleed layouts. */
    contentClass?: HTMLAttributes['class']
  }>(),
  {
    title: undefined,
    showCloseButton: true,
    class: undefined,
    contentClass: undefined
  }
)

function close(): void {
  try {
    webview.close()
  } catch {
    // Standalone preview outside a webview embed; nothing to close.
  }
}
</script>

<template>
  <div
    data-slot="webview-dialog-shell"
    :class="cn('relative flex h-screen flex-col', props.class)"
  >
    <DialogHeader class="rounded-none">
      <slot name="header">
        <h1 class="truncate text-sm font-medium">{{ props.title }}</h1>
      </slot>
    </DialogHeader>

    <div
      data-slot="webview-dialog-shell-body"
      :class="cn('min-h-0 flex-1 overflow-y-auto px-4 py-3', props.contentClass)"
    >
      <slot />
    </div>

    <DialogFooter
      v-if="$slots.footer"
      class="rounded-none"
    >
      <slot name="footer" />
    </DialogFooter>

    <DialogCloseButton
      v-if="props.showCloseButton"
      @click="close"
    />
  </div>
</template>
