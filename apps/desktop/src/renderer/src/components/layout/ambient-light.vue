<!--
  AmbientLight
  App material layers: a bottom glow layer (soft radial gradients from the
  theme's light tokens, painted under the whole UI) and a top grain layer
  (full-window noise texture at --grain-opacity, above all surfaces) that
  gives the glass panes a physical material feel and kills gradient banding.
  Dynamic (cover-derived) colors from the light controller override the
  light tokens and cross-fade via @property transitions.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { lightController } from '@renderer/core/theme'

const overrideStyle = computed(() => {
  const colors = lightController.colors.value
  if (!colors) return undefined
  return {
    '--light-1': colors[0],
    '--light-2': colors[1],
    '--light-3': colors[2]
  }
})
</script>

<template>
  <div
    aria-hidden="true"
    class="ambient-light fixed inset-0 -z-10 pointer-events-none"
    :style="overrideStyle"
  />
  <!-- Grain sits above every surface (incl. dialogs) so all planes share
       one material; opacity is low enough to leave text and imagery crisp. -->
  <div
    aria-hidden="true"
    class="ambient-grain fixed inset-0 z-100 pointer-events-none"
  />
</template>

<style scoped>
/* Viewport-relative overlapping washes: the three ellipses tile the whole
 * window (no dead zones) so the UI reads as one continuous glass pane. */
.ambient-light {
  background:
    radial-gradient(
      120% 100% at 0% 0%,
      color-mix(in oklch, var(--light-1) var(--light-strength), transparent),
      transparent 68%
    ),
    radial-gradient(
      120% 100% at 100% 15%,
      color-mix(in oklch, var(--light-2) var(--light-strength), transparent),
      transparent 70%
    ),
    radial-gradient(
      150% 110% at 50% 108%,
      color-mix(in oklch, var(--light-3) calc(var(--light-strength) * 0.9), transparent),
      transparent 70%
    );
  transition:
    --light-1 700ms ease,
    --light-2 700ms ease,
    --light-3 700ms ease;
}

.ambient-grain {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 128px 128px;
  opacity: var(--grain-opacity);
}
</style>
