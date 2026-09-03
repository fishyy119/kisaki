<script setup lang="ts">
import type { AlertDialogContentEmits, AlertDialogContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import {
  AlertDialogContent,
  AlertDialogOverlay,
  AlertDialogPortal,
  useForwardPropsEmits
} from 'reka-ui'
import { cn } from '../../utils/cn'

defineOptions({
  inheritAttrs: false
})

const props = defineProps<
  AlertDialogContentProps & {
    class?: HTMLAttributes['class']
  }
>()
const emits = defineEmits<AlertDialogContentEmits>()

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <AlertDialogPortal data-slot="alert-dialog-portal">
    <div
      data-slot="alert-dialog-positioner"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <AlertDialogOverlay
        data-slot="alert-dialog-overlay"
        class="absolute inset-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <AlertDialogContent
        v-bind="{ ...$attrs, ...forwarded }"
        :class="
          cn(
            'relative flex w-full max-w-sm flex-col max-h-[min(100%,48rem)]',
            'bg-dialog text-dialog-foreground border border-border rounded-md shadow-modal',
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
    </div>
  </AlertDialogPortal>
</template>
