<!-- FieldSeparator component - visual separator with optional content -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useSlots } from 'vue'
import { Separator } from '@renderer/components/ui/separator'
import { cn } from '@renderer/utils/cn'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
const slots = useSlots()
const hasContent = !!slots.default
</script>

<template>
  <div
    data-slot="field-separator"
    :data-content="hasContent"
    :class="
      cn(
        '-my-2 flex h-5 items-center gap-2 text-sm group-data-[variant=outline]/field-group:-mb-2',
        props.class
      )
    "
  >
    <Separator class="flex-1" />
    <template v-if="hasContent">
      <span
        class="text-muted-foreground shrink-0"
        data-slot="field-separator-content"
      >
        <slot />
      </span>
      <Separator class="flex-1" />
    </template>
  </div>
</template>
