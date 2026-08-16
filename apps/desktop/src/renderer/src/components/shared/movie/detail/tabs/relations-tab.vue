<!--
  Movie Relations Tab

  Thin wrapper feeding movie media relations into the shared relations tab.
-->
<script setup lang="ts">
import { MediaRelationsTab } from '@renderer/components/shared/media'
import { useMovie } from '@renderer/composables/use-movie'

const { movie, relations } = useMovie()
</script>

<template>
  <MediaRelationsTab
    v-if="movie"
    media-type="movie"
    :entity-id="movie.id"
    :relations="relations"
  />
</template>
