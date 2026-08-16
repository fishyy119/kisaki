<!--
  Tv Relations Tab

  Thin wrapper feeding series media relations into the shared relations tab.
-->
<script setup lang="ts">
import { MediaRelationsTab } from '@renderer/components/shared/media'
import { useTv } from '@renderer/composables/use-tv'

const { tv, relations } = useTv()
</script>

<template>
  <MediaRelationsTab
    v-if="tv"
    media-type="tv"
    :entity-id="tv.id"
    :relations="relations"
  />
</template>
