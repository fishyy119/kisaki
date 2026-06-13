<!-- Form wrapper: prevents native submission and emits a typed submit event. -->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../utils/cn'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()

const emit = defineEmits<{
  submit: []
}>()

function handleFormSubmit(e: Event) {
  e.preventDefault()
  emit('submit')
}
</script>

<template>
  <form
    :class="cn('relative', props.class)"
    data-slot="form"
    @submit="handleFormSubmit"
  >
    <slot />
  </form>
</template>
