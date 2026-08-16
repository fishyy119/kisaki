<!--
  Game Relations Tab

  Thin wrapper feeding game media relations into the shared relations tab.
-->
<script setup lang="ts">
import { MediaRelationsTab } from '@renderer/components/shared/media'
import { useGame } from '@renderer/composables/use-game'

const { game, relations } = useGame()
</script>

<template>
  <MediaRelationsTab
    v-if="game"
    media-type="game"
    :entity-id="game.id"
    :relations="relations"
  />
</template>
