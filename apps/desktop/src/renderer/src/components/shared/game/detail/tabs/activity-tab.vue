<!--
  Game Detail Activity Tab

  Activity tab showing game play history, statistics and charts. Uses the
  shared media activity panel with the default session titles.
-->

<script setup lang="ts">
import { StateView } from '@renderer/components/ui/state-view'
import { useRenderState } from '@renderer/composables'
import { useGame } from '@renderer/composables/use-game'
import { MediaActivityPanel } from '@renderer/components/shared/media'

const { sessions, isLoading, error } = useGame()

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
    media-type="game"
    :sessions="sessions"
  />
</template>
