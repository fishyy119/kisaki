<!--
  Movie Notes Tab

  Thin wrapper feeding movie notes from the movie context into the shared media
  notes tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { MediaNotesTab } from '@renderer/components/shared/media'
import { useMovie } from '@renderer/composables/use-movie'

const { movie, notes } = useMovie()

const noteRows = computed(() => notes.value.map((note) => ({ ...note, order: note.orderInMovie })))
</script>

<template>
  <MediaNotesTab
    v-if="movie"
    media-type="movie"
    :entity-id="movie.id"
    :notes="noteRows"
  />
</template>
