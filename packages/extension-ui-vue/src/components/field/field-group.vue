<!--
FieldGroup stacks a form's fields in one column at the app's form rhythm.
SettingsSection's `rows` surface restyles this group into bounded,
divider-separated rows; everywhere else it stays a plain stack.
Mirrors the app's components/ui/field recipe.
-->
<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '../../utils/cn'

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
