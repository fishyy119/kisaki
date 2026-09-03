<!--
  DialogBody - The dialog's scroll viewport, and the only part of a dialog that
  ever scrolls. Inside the slab's flex column it takes whatever height the
  header and footer leave and scrolls beyond it; callers never cap it.
-->
<script setup lang="ts">
import { ref, type HTMLAttributes } from 'vue'
import { cn } from '../../utils/cn'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()

// Root element ref for scroll container binding
const rootRef = ref<HTMLElement>()

// Expose $el for parent to access the real DOM element
defineExpose({
  get $el() {
    return rootRef.value
  }
})
</script>

<template>
  <div
    ref="rootRef"
    data-slot="dialog-body"
    :class="cn('min-h-0 grow overflow-y-auto px-4 py-3', props.class)"
  >
    <slot />
  </div>
</template>
