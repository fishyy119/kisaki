<!--
  MediaCardButton - Compact text-button rendering of an entity.

  Button variant of MediaCard used in dense inline contexts (staff lists,
  tag rows). Shares the compact padding and link truncation rules.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cva } from 'class-variance-authority'
import { cn } from '@renderer/utils/cn'
import { Button, type ButtonVariants } from '@renderer/components/ui/button'

const buttonCardVariants = cva('', {
  variants: {
    variant: {
      default: '',
      destructive: '',
      outline: '',
      secondary: '',
      ghost: '',
      link: 'h-auto p-0 shrink truncate',
      text: '',
      input: ''
    },
    size: {
      default: '',
      sm: '',
      xs: '',
      lg: '',
      icon: '',
      'icon-sm': '',
      'icon-xs': '',
      'icon-lg': ''
    }
  },
  compoundVariants: [
    // Only apply compact padding for non-link variants
    { variant: 'secondary', size: 'sm', class: 'h-auto py-1 px-2' },
    { variant: 'ghost', size: 'sm', class: 'h-auto py-1 px-2' }
  ],
  defaultVariants: { variant: 'secondary', size: 'sm' }
})

interface Props {
  name: string
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'sm'
})

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <Button
    data-slot="media-card-button"
    :variant="props.variant"
    :size="props.size"
    :class="cn(buttonCardVariants({ variant: props.variant, size: props.size }), props.class)"
    :title="props.name"
    @click="emit('click')"
  >
    {{ props.name }}
  </Button>
</template>
