<!--
  Comic Notes Tab

  Thin wrapper feeding comic notes from the comic context into the shared
  media notes tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { MediaNotesTab } from '@renderer/components/shared/media'
import { useComic } from '@renderer/composables/use-comic'

const { comic, notes } = useComic()

const noteRows = computed(() => notes.value.map((note) => ({ ...note, order: note.orderInComic })))
</script>

<template>
  <MediaNotesTab
    v-if="comic"
    media-type="comic"
    :entity-id="comic.id"
    :notes="noteRows"
  />
</template>
