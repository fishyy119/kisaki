<!-- AlertDialog footer component -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@renderer/utils/cn'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <div
    :class="cn('flex justify-end gap-2 px-4 pb-4 pt-2', props.class)"
    data-slot="alert-dialog-footer"
  >
    <slot />
  </div>
</template>
