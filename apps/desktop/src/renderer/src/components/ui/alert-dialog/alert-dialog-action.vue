<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/utils/cn'

const props = defineProps<{
  class?: HTMLAttributes['class']
  disabled?: boolean
}>()
</script>

<template>
  <Button
    type="button"
    variant="destructive"
    :disabled="props.disabled"
    :class="cn(props.class)"
    data-slot="alert-dialog-action"
  >
    <slot />
  </Button>
</template>
