<!-- Spinner loading component -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../utils/cn'
import { Icon } from '../icon'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <Icon
    icon="icon-[mdi--loading]"
    :class="cn('size-4 animate-spin', props.class)"
    role="status"
    aria-label="Loading"
    data-slot="spinner"
  />
</template>
