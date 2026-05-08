<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@renderer/utils'
import type { ExtensionResolvedSettingsStatusNode } from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsStatusNode
}>()

const valueClass = computed(() =>
  cn(
    'font-medium',
    props.node.tone === 'success' && 'text-success',
    props.node.tone === 'warning' && 'text-warning',
    props.node.tone === 'danger' && 'text-destructive'
  )
)
</script>

<template>
  <div class="flex items-center justify-between gap-3 text-sm">
    <span
      v-if="props.node.label"
      class="text-muted-foreground"
      >{{ props.node.label }}</span
    >
    <span :class="valueClass">{{ props.node.value }}</span>
  </div>
</template>
