<!--
FieldGroup stacks a form's fields in one column at the app's form rhythm: a
label above its full-width control, bound by proximity. Framing and dividers
belong to the multi-section settings recipe, not to forms; this group stays
plain so every form in the app reads the same.
-->
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
    data-slot="field-group"
    :class="cn('@container flex w-full flex-col gap-5', props.class)"
  >
    <slot />
  </div>
</template>
