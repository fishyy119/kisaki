<!--
  Tv Notes Tab

  Thin wrapper feeding series notes from the tv context into the shared media
  notes tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { MediaNotesTab } from '@renderer/components/shared/media'
import { useTv } from '@renderer/composables/use-tv'

const { tv, notes } = useTv()

const noteRows = computed(() => notes.value.map((note) => ({ ...note, order: note.orderInTv })))
</script>

<template>
  <MediaNotesTab
    v-if="tv"
    media-type="tv"
    :entity-id="tv.id"
    :notes="noteRows"
  />
</template>
