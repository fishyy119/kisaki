<!--
  ListItem - Editable list row for list-form dialogs.

  Layout: leading icon tile (or custom #leading), title/description text
  (or custom default slot), and hover-revealed #actions on the right.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/utils/cn'

interface Props {
  /** Icon rendered in the leading muted tile; override via #leading */
  icon?: string
  title?: string
  description?: string
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <div
    data-slot="list-item"
    :class="
      cn(
        'group flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-accent/30',
        props.class
      )
    "
  >
    <slot name="leading">
      <div
        v-if="props.icon"
        class="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted"
      >
        <Icon
          :icon="props.icon"
          class="size-5 text-muted-foreground"
        />
      </div>
    </slot>

    <div class="min-w-0 flex-1">
      <slot>
        <div class="truncate text-sm font-medium">{{ props.title }}</div>
        <div
          v-if="props.description"
          class="truncate text-xs text-muted-foreground"
        >
          {{ props.description }}
        </div>
      </slot>
    </div>

    <div
      v-if="$slots.actions"
      class="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
    >
      <slot name="actions" />
    </div>
  </div>
</template>
