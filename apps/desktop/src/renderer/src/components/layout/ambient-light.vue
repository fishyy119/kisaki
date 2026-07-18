<!--
  AmbientLight
  The luminaire of the lightbox base. The light layer is a glow sheet (.glow,
  soft radial gradients from the light tokens); the raw page palette from the
  light controller is converged here for the active mode and lands as
  sheet-scoped --light-* overrides. Every converged-palette change (cover
  switch or mode switch) mounts a new sheet keyed by its colors, cross-faded
  via compositor-driven opacity so route-transition jank cannot swallow the
  switch. The diffuser (.grain) is a static noise sheet that textures the
  lamp and dithers its gradients. Both sit under every painted region; the
  translucent base panes transmit them, so content, popovers, and dialogs
  stay untextured. Recipes live in globals.css ("Lightbox recipes").
-->
<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import { storeToRefs } from 'pinia'
import { convergeAmbientPalette, lightController } from '@renderer/core/theme'
import { useThemeStore } from '@renderer/stores/theme'

const { resolvedTheme } = storeToRefs(useThemeStore())

const colors = computed(() => {
  const palette = lightController.palette.value
  return palette ? convergeAmbientPalette(palette, resolvedTheme.value) : null
})

// Key by converged content so identical palettes never restart a fade.
const paletteKey = computed(() => colors.value?.join('|') ?? 'theme')

const paletteVars = computed<CSSProperties | undefined>(() => {
  if (!colors.value) return undefined
  return {
    '--light-1': colors.value[0],
    '--light-2': colors.value[1],
    '--light-3': colors.value[2]
  }
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
