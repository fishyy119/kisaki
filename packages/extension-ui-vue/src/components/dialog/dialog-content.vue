<!--
  DialogContent - The dialog slab and the only owner of dialog geometry inside
  a webview document. Mirrors the app primitive: a positioner fills the
  document viewport (webview documents have no window chrome of their own),
  padded by the modal inset, centering a flex-column slab whose width is the
  declared step and whose height is either content-sized (`max-h`) or, with
  `fill`, the definite remaining height - both up to the dialog ceiling.
-->
<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { DialogClose, DialogContent, DialogPortal, useForwardPropsEmits } from 'reka-ui'
import { cn } from '../../utils/cn'
import DialogCloseButton from './dialog-close-button.vue'
import DialogOverlay from './dialog-overlay.vue'
import type { DialogSize } from './types'

defineOptions({
  inheritAttrs: false
})

const props = withDefaults(
  defineProps<
    DialogContentProps & {
      class?: HTMLAttributes['class']
      size?: DialogSize
      fill?: boolean
      showCloseButton?: boolean
    }
  >(),
  {
    size: 'md',
    fill: false,
    showCloseButton: true
  }
)
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'size', 'fill', 'showCloseButton')

const forwarded = useForwardPropsEmits(delegatedProps, emits)

const SIZE_CLASSES: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl'
}

function handleInteractOutside(event: Event) {
  event.preventDefault()
}

function handleCloseAutoFocus(event: Event) {
  // Prevent focus restoration to avoid scroll jumping when dialog closes
  event.preventDefault()
}
</script>

<template>
  <DialogPortal data-slot="dialog-portal">
    <div
      data-slot="dialog-positioner"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <DialogOverlay />
      <DialogContent
        data-slot="dialog-content"
        v-bind="{ ...$attrs, ...forwarded }"
        :class="
          cn(
            'relative flex w-full flex-col',
            SIZE_CLASSES[props.size],
            props.fill ? 'h-[min(100%,48rem)]' : 'max-h-[min(100%,48rem)]',
            'bg-dialog text-dialog-foreground border border-border rounded-md shadow-modal',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'duration-150',
            props.class
          )
        "
        @interact-outside="handleInteractOutside"
        @close-auto-focus="handleCloseAutoFocus"
      >
        <slot />
        <DialogClose
          v-if="props.showCloseButton"
          as-child
          data-slot="dialog-close"
        >
          <DialogCloseButton />
        </DialogClose>
      </DialogContent>
    </div>
  </DialogPortal>
</template>
