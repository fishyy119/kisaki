<!--
  TabsTrigger - One tab. Declares its icon and label as props so the list can
  collapse the label by container width; the label then survives as the
  trigger title. The slot carries extras (counts) that stay visible.
-->
<script setup lang="ts">
import type { TabsTriggerProps } from 'reka-ui'
import { inject, type HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { TabsTrigger, useForwardProps } from 'reka-ui'
import { Icon } from '@renderer/components/ui/icon'
import { cn } from '@renderer/utils/cn'
import { TabsListCollapsibleKey } from './context'

const props = defineProps<
  TabsTriggerProps & {
    class?: HTMLAttributes['class']
    icon?: string
    label?: string
  }
>()

const delegatedProps = reactiveOmit(props, 'class', 'icon', 'label')

const forwardedProps = useForwardProps(delegatedProps)

const collapsible = inject(TabsListCollapsibleKey, undefined)
</script>

<template>
  <TabsTrigger
    data-slot="tabs-trigger"
    :class="
      cn(
        'inline-flex h-full shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground whitespace-nowrap transition-colors',
        'hover:text-foreground',
        'data-[state=active]:bg-accent data-[state=active]:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
        'disabled:pointer-events-none disabled:opacity-50',
        `[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5`,
        props.class
      )
    "
    :title="collapsible ? props.label : undefined"
    v-bind="forwardedProps"
  >
    <Icon
      v-if="props.icon"
      :icon="props.icon"
      class="size-3.5 shrink-0"
    />
    <span
      v-if="props.label"
      data-slot="tabs-trigger-label"
    >
      {{ props.label }}
    </span>
    <slot />
  </TabsTrigger>
</template>
