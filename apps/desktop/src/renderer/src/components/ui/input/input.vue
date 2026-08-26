<!--
  Input
  Single-line text input. The model is always a string, including for
  type="number"; numeric fields keep raw text in state and parse at their
  submit boundary.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { nextTick, ref, watch } from 'vue'
import { cn } from '@renderer/utils/cn'

const props = defineProps<{
  type?: string
  placeholder?: string
  min?: string | number
  max?: string | number
  step?: string | number
  disabled?: boolean
  readonly?: boolean
  class?: HTMLAttributes['class']
}>()

// Native v-model would coerce type="number" values to numbers (Vue's built-in
// cast), breaking the string contract. The DOM value is synced manually
// instead, and IME composition sessions own the DOM value until they end.
const model = defineModel<string>({ default: '' })

const inputElement = ref<HTMLInputElement | null>(null)
let isComposing = false

watch(
  [model, inputElement],
  ([value, element]) => {
    if (!element || isComposing) return
    if (element.value !== value) element.value = value
  },
  { flush: 'post' }
)

async function handleInput(event: Event) {
  if (isComposing) return
  const element = event.target as HTMLInputElement
  model.value = element.value
  // A controlled parent may normalize or reject the emitted value without
  // changing the prop; re-sync the DOM to whatever actually settled.
  await nextTick()
  if (!isComposing && element.value !== model.value) element.value = model.value
}

function handleCompositionStart() {
  isComposing = true
}

function handleCompositionEnd(event: Event) {
  if (!isComposing) return
  isComposing = false
  handleInput(event)
}
</script>

<template>
  <input
    ref="inputElement"
    :type="props.type ?? 'text'"
    :placeholder="props.placeholder"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    :disabled="props.disabled"
    :readonly="props.readonly"
    data-slot="input"
    :class="
      cn(
        'flex h-7 w-full min-w-0 rounded-md bg-input border border-border px-2 py-1 text-sm transition-colors',
        'placeholder:text-muted-foreground',
        'focus:border-primary focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        props.type === 'number' &&
          '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]',
        (props.type === 'date' || props.type === 'datetime-local' || props.type === 'time') &&
          '[&::-webkit-calendar-picker-indicator]:hidden',
        props.class
      )
    "
    :spellcheck="false"
    @input="handleInput"
    @compositionstart="handleCompositionStart"
    @compositionend="handleCompositionEnd"
  />
</template>
