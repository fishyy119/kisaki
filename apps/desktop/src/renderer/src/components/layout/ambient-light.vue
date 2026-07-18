<!--
  AmbientLight
  The luminaire of the lightbox base. The light layer is a glow sheet (.glow,
  soft radial gradients from the light tokens); page palettes from the light
  controller land as sheet-scoped --light-* overrides, and every palette
  change mounts a new sheet keyed by its colors, cross-faded via
  compositor-driven opacity so route-transition jank cannot swallow the
  switch. The diffuser (.grain) is a static noise sheet that textures the
  lamp and dithers its gradients. Both sit under every painted region; the
  translucent base panes transmit them, so content, popovers, and dialogs
  stay untextured. Recipes live in globals.css ("Lightbox recipes").
-->
<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import { lightController } from '@renderer/core/theme'

// Key by palette content so identical palettes never restart a fade.
const paletteKey = computed(() => lightController.colors.value?.join('|') ?? 'theme')

const paletteVars = computed<CSSProperties | undefined>(() => {
  const colors = lightController.colors.value
  if (!colors) return undefined
  return { '--light-1': colors[0], '--light-2': colors[1], '--light-3': colors[2] }
})
</script>

<template>
  <Transition name="glow-fade">
    <div
      :key="paletteKey"
      aria-hidden="true"
      class="glow fixed inset-0 -z-10 pointer-events-none"
      :style="paletteVars"
    />
  </Transition>
  <div
    aria-hidden="true"
    class="grain fixed inset-0 -z-10 pointer-events-none"
  />
</template>
