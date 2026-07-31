<!--
  MdiIcon - Runtime-resolved MDI icon rendered as a currentColor CSS mask.

  Use for MDI names that are only known at runtime (extension contributions);
  static app icons keep the zero-runtime Icon component. Visual behavior
  matches Icon exactly: monochrome silhouette following the surrounding text
  color.

  Usage:
    <MdiIcon name="sync" class="size-5" />
-->
<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { cn } from '@renderer/utils/cn'
import { resolveMdiIconMaskUrl } from './mdi'

const props = defineProps<{
  /** MDI icon name without the `mdi:` prefix, e.g. `sync`. */
  name: string
  class?: string
}>()

const maskUrl = ref<string | null>(null)

watchEffect(async () => {
  const name = props.name
  const url = await resolveMdiIconMaskUrl(name)
  if (name === props.name) {
    maskUrl.value = url
  }
})

const maskStyle = computed(() =>
  maskUrl.value
    ? {
        backgroundColor: 'currentcolor',
        maskImage: maskUrl.value,
        maskSize: '100% 100%',
        maskRepeat: 'no-repeat'
      }
    : undefined
)
</script>

<template>
  <span
    :class="cn('inline-block shrink-0', props.class)"
    :style="maskStyle"
    aria-hidden="true"
  />
</template>
