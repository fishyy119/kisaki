<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@renderer/utils/cn'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <tfoot
    data-slot="table-footer"
    :class="cn('[&_tr]:hover:bg-transparent', props.class)"
  >
    <slot />
  </tfoot>
</template>
