<!--
  DialogContent - The dialog slab and the only owner of dialog geometry.

  Every dialog portals into the document's modal layer and brings its own
  positioner: a box filling the region, padded by the modal inset, centering
  the slab. The slab is a flex column so header and footer stay put while the
  body scrolls. Geometry is declared, never styled:

  - `size` is the width step (a content class, see DialogSize); the positioner
    clamps it at small windows.
  - `fill` gives the slab a definite height - the region height up to the
    dialog height ceiling - for tool dialogs whose content is unbounded or
    varies (tabs, tables, virtual lists). Without it the slab grows with its
    content up to the same ceiling.

  Both bounds are rem (content units that follow the interface scale) clamped
  by the region (a percentage of the positioner); no viewport units anywhere.
  The ceiling equals the region height at the comfortable tier (1280x720), so
  it only binds on tall windows, where it keeps slab proportions stable.
-->
<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { Icon } from '@renderer/components/ui/icon'
import { DialogClose, DialogContent, DialogPortal, useForwardPropsEmits } from 'reka-ui'
import { useI18n } from '@renderer/composables/use-i18n'
import { cn } from '@renderer/utils/cn'
import { MODAL_LAYER_SELECTOR } from './constants'
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

const { m } = useI18n()

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
  <DialogPortal
    data-slot="dialog-portal"
    :to="MODAL_LAYER_SELECTOR"
  >
    <div
      data-slot="dialog-positioner"
      class="absolute inset-0 flex items-center justify-center p-4"
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
          data-slot="dialog-close"
          class="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus:outline-none focus:ring-1 focus:ring-primary flex items-center justify-center"
        >
          <Icon
            icon="icon-[mdi--close]"
            class="size-4"
          />
          <span class="sr-only">{{ m.actions.close }}</span>
        </DialogClose>
      </DialogContent>
    </div>
  </DialogPortal>
</template>
