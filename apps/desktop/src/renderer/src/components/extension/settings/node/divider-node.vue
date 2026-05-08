<script setup lang="ts">
import type { ExtensionResolvedSettingsDividerNode } from '@shared/extension'

defineProps<{
  node: ExtensionResolvedSettingsDividerNode
}>()
</script>

<template>
  <div class="h-px w-full bg-border" />
</template>
