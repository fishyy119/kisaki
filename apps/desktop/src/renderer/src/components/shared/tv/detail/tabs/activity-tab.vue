<!--
  Tv Detail Activity Tab

  Activity tab showing series watch history, statistics and charts. Uses the
  shared media activity panel with season-and-episode codes as session titles.
-->

<script setup lang="ts">
import { computed } from 'vue'
import { StateView } from '@renderer/components/ui/state-view'
import { useRenderState } from '@renderer/composables'
import { useTv } from '@renderer/composables/use-tv'
import { useI18n } from '@renderer/composables/use-i18n'
import { MediaActivityPanel } from '@renderer/components/shared/media'

const { seasons, sessions, isLoading, error } = useTv()
const { m } = useI18n()

const state = useRenderState(isLoading, error, sessions)

/**
 * An episode name alone reads ambiguously across seasons, so the title carries
 * the SxxEyy code whenever both numbers are known.
 */
const episodeTitles = computed(() => {
  const titles = new Map<string, string>()
  for (const season of seasons.value) {
    for (const episode of season.episodes) {
      const code =
        episode.episodeNumber === null
          ? null
          : m.value.tv.episodes.code({
              season: season.seasonNumber,
              episode: String(episode.episodeNumber)
            })
      const name =
        episode.name ??
        (episode.episodeNumber === null
          ? null
          : m.value.tv.episodes.unnamed({ number: String(episode.episodeNumber) }))
      titles.set(episode.id, [code, name].filter(Boolean).join(' · ') || m.value.common.emptyValue)
    }
  }
  return titles
})

function sessionTitle(session: { episodeId?: string | null }): string {
  if (!session.episodeId) return m.value.common.emptyValue
  return episodeTitles.value.get(session.episodeId) ?? m.value.common.emptyValue
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
    media-type="tv"
    :sessions="sessions"
  >
    <template #session-title="{ session }">
      {{ sessionTitle(session) }}
    </template>
  </MediaActivityPanel>
</template>
