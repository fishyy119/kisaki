<!--
Webview Page Shell is the document scaffold for page-surface webviews: the
app page-header anatomy (title strip with actions) over a scrollable content
region. Regions follow the app lightbox contract — the header paints one
surface pane and the content paints one background pane, while the kit
stylesheet clears the default document base pane — so light transmission
matches native app pages exactly.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../utils/cn'

const props = defineProps<{
  /** Visible page title; replace the whole left group with the header slot. */
  title?: string
  class?: HTMLAttributes['class']
  /** Class of the scrollable content region. */
  contentClass?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="webview-page-shell"
    :class="cn('flex h-screen flex-col', props.class)"
  >
    <header
      data-slot="webview-page-shell-header"
      class="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4"
    >
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <slot name="header">
          <h1 class="truncate text-base font-semibold">{{ props.title }}</h1>
        </slot>
      </div>

      <div
        v-if="$slots.actions"
        class="flex shrink-0 items-center gap-2"
      >
        <slot name="actions" />
      </div>
    </header>

    <div
      data-slot="webview-page-shell-content"
      :class="cn('min-h-0 flex-1 overflow-y-auto bg-background', props.contentClass)"
    >
      <slot />
    </div>
  </div>
</template>
