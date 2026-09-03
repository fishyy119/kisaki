<!-- SegmentedControl root component for controlled state switching -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { TabsRoot } from 'reka-ui'
import type { ContainerStep } from '@renderer/components/ui/container'
import { TabsList } from '@renderer/components/ui/tabs'

interface Props {
  defaultValue?: string
  /** Container step below which item labels collapse to icons. */
  collapseBelow?: ContainerStep
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

const model = defineModel<string>()
</script>

<template>
  <!-- Shrink-to-fit in a row (so it queries the row, not itself), yet never
       wider than the row: the list's max-width and scroll fallback apply -->
  <TabsRoot
    v-model="model"
    :default-value="props.defaultValue"
    class="min-w-0 max-w-full"
    data-slot="segmented-control"
  >
    <TabsList
      :class="props.class"
      :collapse-below="props.collapseBelow"
      data-slot="segmented-control-list"
    >
      <slot />
    </TabsList>
  </TabsRoot>
</template>
