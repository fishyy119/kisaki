<!--
  Movie Files Tab

  The playable releases of the feature with the file toolbar (files
  configuration, sync, manual attachment), followed by the extras that belong to
  the entry but carry no watch state. A film has one consumption unit, so the
  watch state itself lives on the entry rather than on any file row.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { eq } from 'drizzle-orm'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Section } from '@renderer/components/ui/section'
import { useI18n } from '@renderer/composables/use-i18n'
import { useMovie } from '@renderer/composables/use-movie'
import { revealMovieFile, useMovieFileRecords } from '@renderer/composables/use-movie-file-records'
import { useMovieFileSync } from '@renderer/composables/use-movie-file-sync'
import { useMovieWatch } from '@renderer/composables/use-movie-watch'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { cn } from '@renderer/utils/cn'
import { movieFiles, MOVIE_EXTRA_TYPE_VALUES } from '@shared/db'
import { MovieFilesConfigFormDialog } from '../../../forms'
import MovieDetailExtraItem from './extra-item.vue'
import MovieExtraDetailDialog from './extra-detail-dialog.vue'
import MovieExtraFormDialog from './extra-form-dialog.vue'
import MovieFileRecordList from './file-record-list.vue'
import { MediaPlaybackProgress } from '@renderer/components/shared/media'

const log = createLogger('Movie')

const { movie, files, extras } = useMovie()
const { m } = useI18n()
const { isSyncing, syncFiles } = useMovieFileSync()

const filesConfigOpen = ref(false)

const canSyncFiles = computed(() => !!movie.value?.movieDirPath)

async function handleSyncFiles(): Promise<void> {
  const current = movie.value
  if (!current) return
  if (!current.movieDirPath) {
    notify.error(m.value.movie.detail.movieDirNotSet)
    return
  }

  await syncFiles(current.id)
}

// =============================================================================
// Playback and release records
// =============================================================================

const {
  isWatching,
  playbackStatus,
  playbackProgress,
  watch: watchMovie
} = useMovieWatch(() => movie.value?.id ?? '')

// The entry owns its releases directly, so the file owner is the movie itself.
const fileOwner = computed(() => {
  const current = movie.value
  return current ? { id: current.id, files: files.value } : null
})

const { isAttaching, attachFile, setPrimary, removeFile, saveNote } = useMovieFileRecords({
  owner: fileOwner,
  table: movieFiles,
  ownerColumn: movieFiles.movieId,
  attach: (movieId, path) => ipcManager.invoke('ingest:attach-movie-file', { movieId, path })
})

/** Editions label the releases of one film, so only entry files carry them. */
async function saveEdition(fileId: string, edition: string | null): Promise<void> {
  try {
    await db.update(movieFiles).set({ edition }).where(eq(movieFiles.id, fileId))
    notify.success(m.value.movie.files.editionSaved)
  } catch (error) {
    log.error('File edition update failed:', error)
    notify.error(m.value.library.feedback.updateFailed)
  }
}

// =============================================================================
// Extras
// =============================================================================

const addExtraOpen = ref(false)
const openExtraId = ref<string | null>(null)

/** Single list in canonical type order; the row badge carries the type. */
const sortedExtras = computed(() =>
  [...extras.value].sort(
    (a, b) => MOVIE_EXTRA_TYPE_VALUES.indexOf(a.type) - MOVIE_EXTRA_TYPE_VALUES.indexOf(b.type)
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
    v-if="movie"
    class="space-y-6"
  >
    <Section :title="m.movie.files.title">
      <template #actions>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            @click="filesConfigOpen = true"
          >
            <Icon
              icon="icon-[mdi--folder-cog-outline]"
              class="size-4 mr-1.5"
            />
            {{ m.movie.filesConfig.title }}
          </Button>

          <Button
            variant="outline"
            size="sm"
            :disabled="!canSyncFiles || isSyncing"
            :tooltip="canSyncFiles ? undefined : m.movie.detail.movieDirNotSet"
            @click="handleSyncFiles"
          >
            <Icon
              :icon="isSyncing ? 'icon-[mdi--loading]' : 'icon-[mdi--folder-sync-outline]'"
              :class="cn('size-4 mr-1.5', isSyncing && 'animate-spin')"
            />
            {{ m.movie.files.syncFiles }}
          </Button>
        </div>
      </template>

      <!-- Live playback progress of the feature -->
      <MediaPlaybackProgress
        v-if="isWatching"
        :status="playbackStatus"
        :progress="playbackProgress"
      />

      <MovieFileRecordList
        :files="files"
        :empty-text="m.movie.files.emptyHint"
        :attaching="isAttaching"
        editions
        @attach="attachFile"
        @play="watchMovie"
        @set-primary="setPrimary"
        @remove-file="removeFile"
        @open-folder="revealMovieFile"
        @save-note="saveNote"
        @save-edition="saveEdition"
      />
    </Section>

    <Section
      :title="m.movie.extras.title"
      :empty="extras.length === 0"
      :empty-text="m.movie.extras.emptyHint"
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
          {{ m.movie.extras.addExtra }}
        </Button>
      </template>

      <div class="space-y-2">
        <MovieDetailExtraItem
          v-for="extra in sortedExtras"
          :key="extra.id"
          :extra="extra"
          @open-folder="revealMovieFile"
          @open-detail="openExtraId = extra.id"
        />
      </div>
    </Section>

    <!-- Files configuration dialog -->
    <MovieFilesConfigFormDialog
      v-if="filesConfigOpen"
      v-model:open="filesConfigOpen"
      :movie-id="movie.id"
    />

    <!-- Extra create dialog -->
    <MovieExtraFormDialog
      v-if="addExtraOpen"
      v-model:open="addExtraOpen"
      :movie-id="movie.id"
    />

    <!-- Extra detail dialog -->
    <MovieExtraDetailDialog
      v-if="openExtraId"
      v-model:open="extraDetailOpen"
      :movie-id="movie.id"
      :extra-id="openExtraId"
    />
  </div>
</template>
