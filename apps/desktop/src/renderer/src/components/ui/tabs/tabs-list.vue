<!--
  TabsList - The row of triggers. Never wider than its container: with
  `collapseBelow` the trigger labels hide once the nearest query container is
  narrower than that step (icons and counts stay, the label moves into the
  trigger title); a row that is still too wide scrolls rather than overflowing
  the surface. The call site picks the step because it knows what else shares
  the container with the list.
-->
<script setup lang="ts">
import type { TabsListProps } from 'reka-ui'
import { computed, provide, type HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { TabsList } from 'reka-ui'
import type { ContainerStep } from '@renderer/components/ui/container'
import { cn } from '@renderer/utils/cn'
import { TabsListCollapsibleKey } from './context'

const props = defineProps<
  TabsListProps & {
    class?: HTMLAttributes['class']
    /** Container step below which trigger labels collapse to icons. */
    collapseBelow?: ContainerStep
  }
>()

const delegatedProps = reactiveOmit(props, 'class', 'collapseBelow')

const COLLAPSE_CLASSES: Record<ContainerStep, string> = {
  sm: '@max-sm:[&_[data-slot=tabs-trigger-label]]:hidden',
  md: '@max-md:[&_[data-slot=tabs-trigger-label]]:hidden',
  lg: '@max-lg:[&_[data-slot=tabs-trigger-label]]:hidden',
  xl: '@max-xl:[&_[data-slot=tabs-trigger-label]]:hidden',
  '2xl': '@max-2xl:[&_[data-slot=tabs-trigger-label]]:hidden',
  '3xl': '@max-3xl:[&_[data-slot=tabs-trigger-label]]:hidden',
  '4xl': '@max-4xl:[&_[data-slot=tabs-trigger-label]]:hidden',
  '5xl': '@max-5xl:[&_[data-slot=tabs-trigger-label]]:hidden',
  '6xl': '@max-6xl:[&_[data-slot=tabs-trigger-label]]:hidden',
  '7xl': '@max-7xl:[&_[data-slot=tabs-trigger-label]]:hidden'
}

provide(
  TabsListCollapsibleKey,
  computed(() => props.collapseBelow !== undefined)
)
</script>

<template>
  <TabsList
    data-slot="tabs-list"
    v-bind="delegatedProps"
    :class="
      cn(
        'inline-flex h-7 max-w-full min-w-0 items-center gap-0.5 overflow-x-auto rounded-md bg-muted p-0.5 [scrollbar-width:none]',
        props.collapseBelow && COLLAPSE_CLASSES[props.collapseBelow],
        props.class
      )
    "
  >
    <slot />
  </TabsList>
</template>
