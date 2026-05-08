<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@renderer/utils'
import type { ExtensionResolvedSettingsTextNode } from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsTextNode
}>()

const textClass = computed(() =>
  cn(
    'text-sm',
    props.node.tone === 'muted' && 'text-muted-foreground',
    props.node.tone === 'danger' && 'text-destructive'
  )
)
</script>

<template>
  <p :class="textClass">{{ props.node.text }}</p>
</template>
