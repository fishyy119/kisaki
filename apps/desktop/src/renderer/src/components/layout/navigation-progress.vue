<!--
  NavigationProgress
  Route-level loading indicator: a thin indeterminate bar pinned to the top
  of the window while a navigation (including its data loaders) is pending.
  Appears only after a delay so millisecond-level local loads stay invisible;
  this is the single loading indication for route transitions.
-->
<script setup lang="ts">
import { isNavigationPending } from '@renderer/core/route-data'
import { useDelayedLoading } from '@renderer/composables'

const { showLoading } = useDelayedLoading(isNavigationPending, 'local')
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-150"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-300"
    leave-to-class="opacity-0"
  >
    <div
      v-if="showLoading"
      class="absolute inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
    >
      <div class="navigation-progress-indicator h-full w-1/3 rounded-full bg-primary" />
    </div>
  </Transition>
</template>

<style scoped>
.navigation-progress-indicator {
  animation: navigation-progress-slide 1.2s ease-in-out infinite;
}

@keyframes navigation-progress-slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}
</style>
