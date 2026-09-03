<script setup lang="ts">
import type { SelectTriggerProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { SelectIcon, SelectTrigger, useForwardProps } from 'reka-ui'
import { Icon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/utils/cn'

const props = withDefaults(
  defineProps<SelectTriggerProps & { class?: HTMLAttributes['class']; size?: 'sm' | 'default' }>(),
  { size: 'default' }
)

const delegatedProps = reactiveOmit(props, 'class', 'size')
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <SelectTrigger
    data-slot="select-trigger"
    :data-size="size"
    v-bind="forwardedProps"
    :class="
      cn(
        'flex w-fit min-w-0 items-center gap-2 rounded-md border bg-input border-border px-2 text-sm whitespace-nowrap transition-colors outline-none',
        // The value never widens the trigger: callers size it, the text truncates.
        // Leading content (an icon, the value) packs left; only the chevron is pushed to the end.
        '*:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate',
        '*:data-[slot=select-value]:text-left',
        'data-[placeholder]:text-muted-foreground',
        'focus:border-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[size=default]:h-7 data-[size=sm]:h-6 data-[size=sm]:text-xs',
        `[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5`,
        props.class
      )
    "
  >
    <slot />
    <SelectIcon as-child>
      <Icon
        icon="icon-[mdi--chevron-down]"
        class="ml-auto size-3.5 opacity-50"
      />
    </SelectIcon>
  </SelectTrigger>
</template>
