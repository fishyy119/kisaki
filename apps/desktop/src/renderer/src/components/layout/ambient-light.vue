<!--
  AmbientLight
  The luminaire of the lightbox base: the light layer (.glow, soft radial
  gradients from the light tokens - the only dynamic layer, cross-fading via
  @property transitions when the light controller overrides --light-* on the
  document root) and the diffuser (.grain, a static noise sheet that textures
  the lamp and dithers its gradients). Both sit under every painted region;
  the translucent base panes transmit them, so content, popovers, and dialogs
  stay untextured. Recipes live in globals.css ("Lightbox recipes").
-->
<template>
  <div
    aria-hidden="true"
    class="glow fixed inset-0 -z-10 pointer-events-none"
  />
  <div
    aria-hidden="true"
    class="grain fixed inset-0 -z-10 pointer-events-none"
  />
</template>
