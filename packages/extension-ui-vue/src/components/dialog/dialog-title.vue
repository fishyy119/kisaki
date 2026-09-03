<!--
  DialogTitle - One line that always fits: an optional leading icon, the title
  text (truncated, never wrapped), and optional trailing adornments that keep
  their size.
-->
<script setup lang="ts">
import type { DialogTitleProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { DialogTitle, useForwardProps } from 'reka-ui'
import { cn } from '../../utils/cn'
import { Icon } from '../icon'

const props = defineProps<
  DialogTitleProps & {
    class?: HTMLAttributes['class']
    /** Leading icon class (Iconify), muted like every identity icon. */
    icon?: string
  }
>()

const delegatedProps = reactiveOmit(props, 'class', 'icon')

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <DialogTitle
    data-slot="dialog-title"
    v-bind="forwardedProps"
    :class="cn('flex min-w-0 items-center gap-2 text-sm font-medium', props.class)"
  >
    <Icon
      v-if="props.icon"
      :icon="props.icon"
      class="size-4 shrink-0 text-muted-foreground"
    />
    <span class="min-w-0 truncate"><slot /></span>
    <slot name="trailing" />
  </DialogTitle>
</template>
