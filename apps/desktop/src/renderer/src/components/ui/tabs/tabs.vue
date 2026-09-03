<!--
  Tabs - Root of a tabbed surface. A query container, so the list of triggers
  (which stretches to this root's width) can collapse its labels by the width
  the tabs actually get.
-->
<script setup lang="ts">
import type { TabsRootEmits, TabsRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { TabsRoot, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@renderer/utils/cn'

const props = defineProps<TabsRootProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<TabsRootEmits>()

const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <TabsRoot
    v-slot="slotProps"
    data-slot="tabs"
    v-bind="forwarded"
    :class="cn('@container flex flex-col gap-4', props.class)"
  >
    <slot v-bind="slotProps" />
  </TabsRoot>
</template>
