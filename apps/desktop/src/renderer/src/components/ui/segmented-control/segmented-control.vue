<!-- SegmentedControl root component for controlled state switching -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { TabsRoot } from 'reka-ui'
import { TabsList } from '@renderer/components/ui/tabs'

interface Props {
  defaultValue?: string
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

const model = defineModel<string>()
</script>

<template>
  <TabsRoot
    v-model="model"
    :default-value="props.defaultValue"
    data-slot="segmented-control"
  >
    <TabsList
      :class="props.class"
      data-slot="segmented-control-list"
    >
      <slot />
    </TabsList>
  </TabsRoot>
</template>
