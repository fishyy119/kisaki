<!--
  Anime Detail Activity Tab

  Activity tab showing anime watch history, statistics and charts. Uses the
  shared media activity panel with episode names as session titles.
-->

<script setup lang="ts">
import { computed } from 'vue'
import { StateView } from '@renderer/components/ui/state-view'
import { useRenderState } from '@renderer/composables'
import { useAnime } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'
import { MediaActivityPanel } from '@renderer/components/shared/media'

const { episodes, sessions, isLoading, error } = useAnime()
const { m } = useI18n()

const state = useRenderState(isLoading, error, sessions)

const episodeNames = computed(
  () => new Map(episodes.value.map((episode) => [episode.id, formatEpisodeName(episode)]))
)

function formatEpisodeName(episode: { episodeNumber: number | null; name: string | null }): string {
  if (episode.name) return episode.name
  if (episode.episodeNumber === null) return m.value.common.emptyValue
  return m.value.anime.episodes.unnamed({ number: String(episode.episodeNumber) })
}

function sessionTitle(session: { episodeId?: string | null }): string {
  if (!session.episodeId) return m.value.common.emptyValue
  return episodeNames.value.get(session.episodeId) ?? m.value.common.emptyValue
}
</script>

<template>
  <!-- Loading / Error -->
  <StateView
    v-if="state !== 'success'"
    :state="state"
    class="py-8"
  />

  <MediaActivityPanel
    v-else
    media-type="anime"
    :sessions="sessions"
  >
    <template #session-title="{ session }">
      {{ sessionTitle(session) }}
    </template>
  </MediaActivityPanel>
</template>
