<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { Primitive } from 'reka-ui'
import { cn } from '@renderer/utils/cn'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { buttonVariants } from './variants'
import type { ButtonProps } from './types'

// Multi-root template (tooltip and plain branches) disables automatic attr
// fallthrough, so attrs are forwarded to the Primitive explicitly.
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<ButtonProps>(), {
  as: 'button'
})

const attrs = useAttrs()

/**
 * A disabled trigger should still explain itself. Native `disabled` swallows
 * the pointer events the tooltip lives on, so a tooltip'd button degrades to
 * `aria-disabled`: announced and styled as disabled, activation blocked, but
 * still hoverable and focusable.
 */
const softDisabled = computed(() => {
  if (!props.tooltip) return false
  const disabled = attrs.disabled
  return disabled === '' || disabled === true
})

/** Caller handlers are withheld instead; this only stops native activation. */
function blockActivation(event: Event): void {
  event.preventDefault()
}

/**
 * One binding set shared by both branches.
 *
 * The tooltip branch renders the Primitive as the trigger's direct slot child
 * on purpose. Reka wires a tooltip to its trigger two ways at once: handlers
 * cloned onto the slot child every render, and a one-time registration of the
 * trigger element that the hover-away close path listens on. A component
 * interposed between the trigger and the element (a reusable template, a
 * wrapper) regenerates the subtree whenever reka toggles its trigger state,
 * splitting those two paths — the tooltip still opens but never closes.
 * Repeating the element per branch is the price; the bindings stay
 * single-sourced here.
 */
const primitiveBindings = computed(() => {
  const bindings: Record<string, unknown> = {
    // Native buttons default to type="button" so form-embedded action buttons
    // never submit implicitly; explicit type attrs still win.
    type: props.as === 'button' && !props.asChild ? 'button' : undefined,
    ...attrs,
    as: props.as,
    asChild: props.asChild,
    class: cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)
  }

  if (softDisabled.value) {
    delete bindings.disabled
    bindings['aria-disabled'] = true
    // Replaces the caller's click handler rather than merging with it.
    bindings.onClick = blockActivation
  }

  return bindings
})
</script>

<template>
  <Tooltip v-if="props.tooltip">
    <TooltipTrigger as-child>
      <Primitive
        v-bind="primitiveBindings"
        data-slot="button"
      >
        <slot />
      </Primitive>
    </TooltipTrigger>
    <TooltipContent>{{ props.tooltip }}</TooltipContent>
  </Tooltip>

  <Primitive
    v-else
    v-bind="primitiveBindings"
    data-slot="button"
  >
    <slot />
  </Primitive>
</template>
