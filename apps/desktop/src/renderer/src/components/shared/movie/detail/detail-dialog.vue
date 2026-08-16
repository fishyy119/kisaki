<!--
  Movie Detail Dialog

  Dialog view for movie details.
  Used when viewing a movie outside the library context.
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { getEntityIcon } from '@renderer/utils/format'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { movies } from '@shared/db'
import { eq } from 'drizzle-orm'
import { useMovieDialogProvider } from '@renderer/composables/use-movie'
import { useDbChanges, useRenderState } from '@renderer/composables'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { Button } from '@renderer/components/ui/button'
import { Separator } from '@renderer/components/ui/separator'
import { SpoilerConfirmDialog } from '@renderer/components/ui/spoiler-confirm-dialog'
import MovieDetailContent from './detail-content.vue'
import MovieWatchButton from '../movie-watch-button.vue'
import { EntityScoreFormDialog, EntityDropdownMenu } from '@renderer/components/shared/entity'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

// =============================================================================
// Props & Model
// =============================================================================

const props = defineProps<{
  movieId: string
}>()

const open = defineModel<boolean>('open', { default: false })

// =============================================================================
// Movie Context (Provider)
// =============================================================================

const movieId = computed(() => props.movieId)
const { movie, isLoading, error, spoilersRevealed } = useMovieDialogProvider(movieId)
const state = useRenderState(isLoading, error, movie)

const spoilerConfirmOpen = ref(false)

useDbChanges(({ operation, table, id }) => {
  if (operation !== 'deleted') return
  if (table === 'movies' && id === props.movieId) {
    open.value = false
  }
})

// =============================================================================
// Local State
// =============================================================================

const isScoreOpen = ref(false)
const isPendingFavorite = ref(false)

// =============================================================================
// Handlers
// =============================================================================

async function handleToggleFavorite() {
  if (state.value !== 'success' || isPendingFavorite.value) return
  const current = movie.value!
  isPendingFavorite.value = true
  try {
    await db
      .update(movies)
      .set({ isFavorite: !current.isFavorite })
      .where(eq(movies.id, current.id))
    notify.success(
      current.isFavorite
        ? m.value.library.feedback.favoriteRemoved
        : m.value.library.feedback.favoriteAdded
    )
  } catch {
    notify.error(m.value.common.operationFailed)
  } finally {
    isPendingFavorite.value = false
  }
}

function handleToggleSpoilers() {
  if (spoilersRevealed.value) {
    spoilersRevealed.value = false
    return
  }
  spoilerConfirmOpen.value = true
}

function handleRevealSpoilersConfirm() {
  spoilersRevealed.value = true
}

async function handleOpenFolder() {
  if (state.value !== 'success') return
  const current = movie.value!
  if (!current.movieDirPath) {
    notify.error(m.value.movie.detail.movieDirNotSet)
    return
  }
  await ipcManager.invoke('native:open-path', { path: current.movieDirPath, ensure: 'folder' })
}

const canOpenMovieDir = computed(() => {
  if (state.value !== 'success') return false
  return !!movie.value?.movieDirPath
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-4xl max-h-[90vh] flex flex-col">
      <!-- Loading / Error / Not Found -->
      <template v-if="state !== 'success'">
        <DialogBody>
          <StateView
            :state="state"
            :error="error"
            :icon="getEntityIcon('movie')"
            :title="m.library.detail.notFoundTitle({ label: m.library.entities.movie })"
            :description="m.library.detail.notFoundDescription({ label: m.library.entities.movie })"
            class="py-12"
          />
        </DialogBody>
      </template>

      <!-- Loaded Content -->
      <template v-else-if="movie">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon
              :icon="getEntityIcon('movie')"
              class="size-4 text-muted-foreground"
            />
            {{ movie.name }}
          </DialogTitle>
        </DialogHeader>
        <DialogBody class="flex-1 min-h-0 overflow-auto p-4">
          <MovieDetailContent />
        </DialogBody>
        <DialogFooter>
          <div class="flex items-center justify-between w-full">
            <!-- Left: Watch button -->
            <MovieWatchButton
              :movie-id="movie.id"
              size="sm"
            />

            <!-- Right: Score, Favorite, Open folder, More -->
            <div class="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="icon-sm"
                :tooltip="m.library.detail.tooltips.score"
                @click="isScoreOpen = true"
              >
                <Icon
                  icon="icon-[mdi--starburst-outline]"
                  class="size-4"
                />
              </Button>

              <Button
                variant="secondary"
                size="icon-sm"
                :tooltip="m.library.detail.tooltips.openDir"
                :disabled="!canOpenMovieDir"
                @click="handleOpenFolder"
              >
                <Icon
                  icon="icon-[mdi--folder-open-outline]"
                  class="size-4"
                />
              </Button>

              <Separator
                orientation="vertical"
                class="h-4"
              />

              <Button
                variant="secondary"
                size="icon-sm"
                :tooltip="
                  movie.isFavorite
                    ? m.library.detail.tooltips.favoriteRemove
                    : m.library.detail.tooltips.favoriteAdd
                "
                :disabled="isPendingFavorite"
                @click="handleToggleFavorite"
              >
                <Icon
                  icon="icon-[mdi--heart-outline]"
                  class="size-4"
                  :class="movie.isFavorite ? 'text-destructive' : ''"
                />
              </Button>

              <Button
                variant="secondary"
                size="icon-sm"
                :tooltip="
                  spoilersRevealed
                    ? m.library.detail.tooltips.spoilerHide
                    : m.library.detail.tooltips.spoilerShow
                "
                @click="handleToggleSpoilers"
              >
                <Icon
                  :icon="
                    spoilersRevealed ? 'icon-[mdi--eye-outline]' : 'icon-[mdi--eye-off-outline]'
                  "
                  class="size-4"
                />
              </Button>

              <Separator
                orientation="vertical"
                class="h-4"
              />

              <EntityDropdownMenu
                entity-type="movie"
                :entity-id="movie.id"
              />
            </div>
          </div>
        </DialogFooter>

        <!-- Score Dialog -->
        <EntityScoreFormDialog
          v-if="isScoreOpen"
          v-model:open="isScoreOpen"
          entity-type="movie"
          :entity-id="movie.id"
        />

        <SpoilerConfirmDialog
          v-if="spoilerConfirmOpen"
          v-model:open="spoilerConfirmOpen"
          @confirm="handleRevealSpoilersConfirm"
        />
      </template>
    </DialogContent>
  </Dialog>
</template>
