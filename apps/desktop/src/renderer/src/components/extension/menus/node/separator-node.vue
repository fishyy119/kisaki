<script setup lang="ts">
import type { MenuComponents } from '@renderer/types'

const props = defineProps<{
  components: MenuComponents
}>()
</script>

<template>
  <component :is="props.components.Separator" />
</template>
