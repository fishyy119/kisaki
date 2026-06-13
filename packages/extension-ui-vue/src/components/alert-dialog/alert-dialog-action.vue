<!-- Confirm button; destructive by default because alert dialogs guard dangerous actions. -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../utils/cn'
import { Button, type ButtonVariants } from '../button'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariants['variant']
    class?: HTMLAttributes['class']
    disabled?: boolean
  }>(),
  {
    variant: 'destructive'
  }
)
</script>

<template>
  <Button
    type="button"
    :variant="props.variant"
    :disabled="props.disabled"
    :class="cn(props.class)"
    data-slot="alert-dialog-action"
  >
    <slot />
  </Button>
</template>
