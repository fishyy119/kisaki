<script setup lang="ts">
import type { AlertDialogContentEmits, AlertDialogContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import {
  AlertDialogContent,
  AlertDialogOverlay,
  AlertDialogPortal,
  useForwardPropsEmits
} from 'reka-ui'
import { cn } from '@renderer/utils'

defineOptions({
  inheritAttrs: false
})

const props = withDefaults(
  defineProps<
    AlertDialogContentProps & {
      class?: HTMLAttributes['class']
      stackLevel?: number
    }
  >(),
  {
    stackLevel: 0
  }
)
const emits = defineEmits<AlertDialogContentEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'stackLevel')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
const overlayZIndex = computed(() => 70 + props.stackLevel * 10)
const contentZIndex = computed(() => overlayZIndex.value + 1)
</script>

<template>
  <AlertDialogPortal data-slot="alert-dialog-portal">
    <AlertDialogOverlay
      data-slot="alert-dialog-overlay"
      :style="{ zIndex: overlayZIndex }"
      class="fixed inset-0 z-[70] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <AlertDialogContent
      v-bind="{ ...$attrs, ...forwarded }"
      :style="{ zIndex: contentZIndex }"
      :class="
        cn(
          'fixed top-[50%] left-[50%] z-[71] w-full max-w-md translate-x-[-50%] translate-y-[-50%]',
          'bg-dialog text-dialog-foreground border border-border rounded-md shadow-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'duration-150',
          props.class
        )
      "
      data-slot="alert-dialog-content"
    >
      <slot />
    </AlertDialogContent>
  </AlertDialogPortal>
</template>
