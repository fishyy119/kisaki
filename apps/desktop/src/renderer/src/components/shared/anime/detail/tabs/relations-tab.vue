<!--
  Anime Relations Tab

  Thin wrapper feeding anime media relations into the shared relations tab.
-->
<script setup lang="ts">
import { MediaRelationsTab } from '@renderer/components/shared/media'
import { useAnime } from '@renderer/composables/use-anime'

const { anime, relations } = useAnime()
</script>

<template>
  <MediaRelationsTab
    v-if="anime"
    media-type="anime"
    :entity-id="anime.id"
    :relations="relations"
  />
</template>
