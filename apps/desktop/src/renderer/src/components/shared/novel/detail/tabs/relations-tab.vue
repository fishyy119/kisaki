<!--
  Novel Relations Tab

  Thin wrapper feeding novel media relations into the shared relations tab.
-->
<script setup lang="ts">
import { MediaRelationsTab } from '@renderer/components/shared/media'
import { useNovel } from '@renderer/composables/use-novel'

const { novel, relations } = useNovel()
</script>

<template>
  <MediaRelationsTab
    v-if="novel"
    media-type="novel"
    :entity-id="novel.id"
    :relations="relations"
  />
</template>
