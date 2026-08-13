<!--
  Anime Notes Tab

  Thin wrapper feeding anime notes from the anime context into the shared
  media notes tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { MediaNotesTab } from '@renderer/components/shared/media'
import { useAnime } from '@renderer/composables/use-anime'

const { anime, notes } = useAnime()

const noteRows = computed(() => notes.value.map((note) => ({ ...note, order: note.orderInAnime })))
</script>

<template>
  <MediaNotesTab
    v-if="anime"
    media-type="anime"
    :entity-id="anime.id"
    :notes="noteRows"
  />
</template>
