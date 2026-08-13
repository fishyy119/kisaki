<!--
  Anime Episodes Tab

  Episode list with watch state, playback actions, and the file toolbar
  (files configuration, sync, manual episode creation), followed by the
  extras that belong to the entry but carry no watch state.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { eq } from 'drizzle-orm'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Section } from '@renderer/components/ui/section'
import { StateView } from '@renderer/components/ui/state-view'
import { useAnimeFileSync } from '@renderer/composables'
import { useAnime } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'
import { cn } from '@renderer/utils/cn'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { animeEpisodes, ANIME_EXTRA_TYPE_VALUES } from '@shared/db'
import type { AnimeEpisodeEntry } from '@renderer/composables/use-anime'
import { AnimeFilesConfigFormDialog } from '../../../forms'
import AnimeDetailEpisodeItem from './episode-item.vue'
import AnimeDetailExtraItem from './extra-item.vue'
import AnimeEpisodeDetailDialog from './episode-detail-dialog.vue'
import AnimeEpisodeFormDialog from './episode-form-dialog.vue'
import AnimeExtraDetailDialog from './extra-detail-dialog.vue'
import AnimeExtraFormDialog from './extra-form-dialog.vue'

const { anime, episodes, extras } = useAnime()
const { m } = useI18n()
const { isSyncing, syncFiles } = useAnimeFileSync()

const addDialogOpen = ref(false)
const filesConfigOpen = ref(false)
const openEpisodeId = ref<string | null>(null)

const watchedCount = computed(
  () => episodes.value.filter((episode) => episode.watchedAt !== null).length
)

const canSyncFiles = computed(() => !!anime.value?.animeDirPath)

const episodeDetailOpen = computed({
  get: () => openEpisodeId.value !== null,
  set: (value) => {
    if (!value) openEpisodeId.value = null
  }
})

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

async function handleSyncFiles(): Promise<void> {
  const current = anime.value
  if (!current) return
  if (!current.animeDirPath) {
    notify.error(m.value.anime.detail.animeDirNotSet)
    return
  }

  await syncFiles(current.id)
}

// =============================================================================
// Extras
// =============================================================================

const addExtraOpen = ref(false)
const openExtraId = ref<string | null>(null)

/** Single list in canonical type order; the row badge carries the type. */
const sortedExtras = computed(() =>
  [...extras.value].sort(
    (a, b) => ANIME_EXTRA_TYPE_VALUES.indexOf(a.type) - ANIME_EXTRA_TYPE_VALUES.indexOf(b.type)
  )
)

const extraDetailOpen = computed({
  get: () => openExtraId.value !== null,
  set: (value) => {
    if (!value) openExtraId.value = null
  }
})
</script>

<template>
  <div
    v-if="anime"
    class="space-y-6"
  >
    <Section :title="m.anime.episodes.title">
      <template #actions>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground">
            {{ m.anime.episodes.progress({ watched: watchedCount, total: episodes.length }) }}
          </span>

          <Button
            variant="outline"
            size="sm"
            @click="addDialogOpen = true"
          >
            <Icon
              icon="icon-[mdi--plus]"
              class="size-4 mr-1.5"
            />
            {{ m.anime.episodes.addEpisode }}
          </Button>

          <Button
            variant="outline"
            size="sm"
            @click="filesConfigOpen = true"
          >
            <Icon
              icon="icon-[mdi--folder-cog-outline]"
              class="size-4 mr-1.5"
            />
            {{ m.anime.filesConfig.title }}
          </Button>

          <Button
            variant="outline"
            size="sm"
            :disabled="!canSyncFiles || isSyncing"
            :tooltip="canSyncFiles ? undefined : m.anime.detail.animeDirNotSet"
            @click="handleSyncFiles"
          >
            <Icon
              :icon="isSyncing ? 'icon-[mdi--loading]' : 'icon-[mdi--folder-sync-outline]'"
              :class="cn('size-4 mr-1.5', isSyncing && 'animate-spin')"
            />
            {{ m.anime.episodes.syncFiles }}
          </Button>
        </div>
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
          @open-detail="openEpisodeId = episode.id"
        />
      </div>
    </Section>

    <Section
      :title="m.anime.extras.title"
      :empty="extras.length === 0"
      :empty-text="m.anime.extras.emptyHint"
    >
      <template #actions>
        <Button
          variant="outline"
          size="sm"
          @click="addExtraOpen = true"
        >
          <Icon
            icon="icon-[mdi--plus]"
            class="size-4 mr-1.5"
          />
          {{ m.anime.extras.addExtra }}
        </Button>
      </template>

      <div class="space-y-2">
        <AnimeDetailExtraItem
          v-for="extra in sortedExtras"
          :key="extra.id"
          :extra="extra"
          @open-folder="handleOpenFolder"
          @open-detail="openExtraId = extra.id"
        />
      </div>
    </Section>

    <!-- Episode detail dialog -->
    <AnimeEpisodeDetailDialog
      v-if="openEpisodeId"
      v-model:open="episodeDetailOpen"
      :anime-id="anime.id"
      :episode-id="openEpisodeId"
    />

    <!-- Create episode dialog -->
    <AnimeEpisodeFormDialog
      v-if="addDialogOpen"
      v-model:open="addDialogOpen"
      :anime-id="anime.id"
    />

    <!-- Files configuration dialog -->
    <AnimeFilesConfigFormDialog
      v-if="filesConfigOpen"
      v-model:open="filesConfigOpen"
      :anime-id="anime.id"
    />

    <!-- Extra create dialog -->
    <AnimeExtraFormDialog
      v-if="addExtraOpen"
      v-model:open="addExtraOpen"
      :anime-id="anime.id"
    />

    <!-- Extra detail dialog -->
    <AnimeExtraDetailDialog
      v-if="openExtraId"
      v-model:open="extraDetailOpen"
      :anime-id="anime.id"
      :extra-id="openExtraId"
    />
  </div>
</template>
