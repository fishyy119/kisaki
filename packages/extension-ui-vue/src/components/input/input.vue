<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useVModel } from '@vueuse/core'
import { cn } from '../../utils/cn'

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  type?: string
  placeholder?: string
  min?: string | number
  max?: string | number
  step?: string | number
  disabled?: boolean
  readonly?: boolean
  class?: HTMLAttributes['class']
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void
}>()

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true
})
</script>

<template>
  <input
    v-model="modelValue"
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
  />
</template>
