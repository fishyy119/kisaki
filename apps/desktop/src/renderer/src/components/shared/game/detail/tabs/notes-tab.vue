<!--
  Game Notes Tab

  Thin wrapper feeding game notes from the game context into the shared
  media notes tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { MediaNotesTab } from '@renderer/components/shared/media'
import { useGame } from '@renderer/composables/use-game'

const { game, notes } = useGame()

const noteRows = computed(() => notes.value.map((note) => ({ ...note, order: note.orderInGame })))
</script>

<template>
  <MediaNotesTab
    v-if="game"
    media-type="game"
    :entity-id="game.id"
    :notes="noteRows"
  />
</template>
