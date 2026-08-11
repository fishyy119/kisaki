<!--
  Anime Episodes Tab

  Episode list with watch state and playback actions, followed by the extras
  that belong to the entry but carry no watch state.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { eq } from 'drizzle-orm'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Section } from '@renderer/components/ui/section'
import { StateView } from '@renderer/components/ui/state-view'
import { useAnime } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { animeEpisodes } from '@shared/db'
import type { AnimeEpisodeEntry } from '@renderer/composables/use-anime'
import AnimeDetailEpisodeItem from './episode-item.vue'

const { anime, episodes, extras } = useAnime()
const { m, f } = useI18n()

const watchedCount = computed(
  () => episodes.value.filter((episode) => episode.watchedAt !== null).length
)

async function handleToggleWatched(episode: AnimeEpisodeEntry): Promise<void> {
  try {
    await db
      .update(animeEpisodes)
      .set(
        episode.watchedAt === null
          ? { watchedAt: new Date(), resumePositionMs: null }
          : { watchedAt: null }
      )
      .where(eq(animeEpisodes.id, episode.id))
    notify.success(m.value.anime.episodes.watchedUpdated)
  } catch {
    notify.error(m.value.library.feedback.updateFailed)
  }
}

async function handleOpenFolder(path: string): Promise<void> {
  const result = await ipcManager.invoke('native:open-path', { path, ensure: 'file' })
  if (!result.success) {
    notify.error(m.value.anime.files.openFolderFailed)
  }
}
</script>

<template>
  <div
    v-if="anime"
    class="space-y-6"
  >
    <Section :title="m.anime.episodes.title">
      <template #actions>
        <span class="text-xs text-muted-foreground">
          {{ m.anime.episodes.progress({ watched: watchedCount, total: episodes.length }) }}
        </span>
      </template>

      <StateView
        v-if="episodes.length === 0"
        state="empty"
        icon="icon-[mdi--playlist-play]"
        :title="m.anime.episodes.emptyTitle"
        :description="m.anime.episodes.emptyHint"
        class="py-10"
      />
      <div
        v-else
        class="space-y-2"
      >
        <AnimeDetailEpisodeItem
          v-for="episode in episodes"
          :key="episode.id"
          :anime-id="anime.id"
          :episode="episode"
          @toggle-watched="handleToggleWatched(episode)"
          @open-folder="handleOpenFolder"
        />
      </div>
    </Section>

    <Section
      :title="m.anime.extras.title"
      :empty="extras.length === 0"
      :empty-text="m.anime.extras.emptyHint"
    >
      <div class="space-y-2">
        <div
          v-for="extra in extras"
          :key="extra.id"
          class="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/50"
        >
          <div class="flex items-center gap-3 min-w-0">
            <Icon
              icon="icon-[mdi--movie-open-outline]"
              class="size-4 text-muted-foreground shrink-0"
            />
            <div class="min-w-0">
              <p class="text-sm font-medium truncate">{{ extra.name }}</p>
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{{ m.library.animeExtraKind[extra.kind] }}</span>
                <template v-if="extra.durationMs">
                  <span>·</span>
                  <span>{{ f.duration(extra.durationMs) }}</span>
                </template>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            :tooltip="m.anime.files.openFolder"
            @click="handleOpenFolder(extra.path)"
          >
            <Icon
              icon="icon-[mdi--folder-open-outline]"
              class="size-4"
            />
          </Button>
        </div>
      </div>
    </Section>
  </div>
</template>
