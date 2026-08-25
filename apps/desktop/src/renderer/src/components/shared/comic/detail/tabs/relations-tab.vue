<!--
  Comic Relations Tab

  Thin wrapper feeding comic media relations into the shared relations tab.
-->
<script setup lang="ts">
import { MediaRelationsTab } from '@renderer/components/shared/media'
import { useComic } from '@renderer/composables/use-comic'

const { comic, relations } = useComic()
</script>

<template>
  <MediaRelationsTab
    v-if="comic"
    media-type="comic"
    :entity-id="comic.id"
    :relations="relations"
  />
</template>
