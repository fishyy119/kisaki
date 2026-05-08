<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@renderer/utils'
import type { ExtensionResolvedSettingsImageNode } from '@shared/extension'

const props = defineProps<{
  node: ExtensionResolvedSettingsImageNode
}>()

const imageClass = computed(() =>
  cn('max-h-60 rounded-md border object-contain', props.node.fit === 'cover' && 'object-cover')
)
</script>

<template>
  <img
    :src="props.node.src"
    :alt="props.node.alt ?? ''"
    :class="imageClass"
  />
</template>
