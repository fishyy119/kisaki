<!-- Page header bar: fixed-height surface strip with optional back link, left content, and right actions -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { RouterLink } from 'vue-router'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/utils/cn'

interface Props {
  /** When set, renders a leading back button linking to this route */
  backTo?: string
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <header
    data-slot="page-header"
    :class="
      cn(
        'shrink-0 flex h-12 items-center gap-3 border-b border-border bg-surface px-4',
        props.class
      )
    "
  >
    <Button
      v-if="props.backTo"
      variant="ghost"
      size="icon-sm"
      as-child
    >
      <RouterLink :to="props.backTo">
        <Icon
          icon="icon-[mdi--arrow-left]"
          class="size-4"
        />
      </RouterLink>
    </Button>

    <div class="flex min-w-0 flex-1 items-center gap-3">
      <slot />
    </div>

    <div
      v-if="$slots.actions"
      class="flex shrink-0 items-center gap-2"
    >
      <slot name="actions" />
    </div>
  </header>
</template>
