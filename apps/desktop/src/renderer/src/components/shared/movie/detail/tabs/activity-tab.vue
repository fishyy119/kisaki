<!--
  Movie Detail Activity Tab

  Activity tab showing movie watch history, statistics and charts. A film has
  one consumption unit, so every session belongs to the feature and the shared
  media activity panel needs no per-session title.
-->

<script setup lang="ts">
import { StateView } from '@renderer/components/ui/state-view'
import { useRenderState } from '@renderer/composables'
import { useMovie } from '@renderer/composables/use-movie'
import { MediaActivityPanel } from '@renderer/components/shared/media'

const { sessions, isLoading, error } = useMovie()

const state = useRenderState(isLoading, error, sessions)
</script>

<template>
  <!-- Loading / Error -->
  <StateView
    v-if="state !== 'success'"
    :state="state"
    class="py-8"
  />

  <MediaActivityPanel
    v-else
    media-type="movie"
    :sessions="sessions"
  />
</template>
