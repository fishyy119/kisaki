<!-- Page header title group: icon, heading, and optional muted meta text -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/utils/cn'

interface Props {
  title: string
  icon?: string
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <div
    data-slot="page-header-title"
    :class="cn('flex min-w-0 items-center gap-3', props.class)"
  >
    <Icon
      v-if="props.icon"
      :icon="props.icon"
      class="size-5 shrink-0"
    />
    <h1 class="truncate text-base font-semibold">{{ props.title }}</h1>
    <span
      v-if="$slots.default"
      class="shrink-0 text-xs text-muted-foreground"
    >
      <slot />
    </span>
  </div>
</template>
