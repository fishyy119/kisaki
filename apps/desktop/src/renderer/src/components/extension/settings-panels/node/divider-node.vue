<script setup lang="ts">
import type { ExtensionResolvedSettingsPanelDividerNode } from '@shared/extension'

defineProps<{
  node: ExtensionResolvedSettingsPanelDividerNode
}>()
</script>

<template>
  <div class="h-px w-full bg-border" />
</template>
