<!--
  Novel Notes Tab

  Thin wrapper feeding novel notes from the novel context into the shared
  media notes tab.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { MediaNotesTab } from '@renderer/components/shared/media'
import { useNovel } from '@renderer/composables/use-novel'

const { novel, notes } = useNovel()

const noteRows = computed(() => notes.value.map((note) => ({ ...note, order: note.orderInNovel })))
</script>

<template>
  <MediaNotesTab
    v-if="novel"
    media-type="novel"
    :entity-id="novel.id"
    :notes="noteRows"
  />
</template>
