<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@renderer/utils'
import type { ExtensionResolvedSettingsPanelNoticeNode } from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsPanelNoticeNode
}>()

const noticeClass = computed(() =>
  cn(
    'rounded-md border px-3 py-2 text-sm',
    props.node.tone === 'info' && 'border-primary/30 bg-primary/10 text-foreground',
    props.node.tone === 'success' && 'border-success/30 bg-success/10 text-foreground',
    props.node.tone === 'warning' && 'border-warning/30 bg-warning/10 text-foreground',
    props.node.tone === 'error' && 'border-destructive/30 bg-destructive/10 text-foreground'
  )
)
</script>

<template>
  <div :class="noticeClass">{{ props.node.text }}</div>
</template>
