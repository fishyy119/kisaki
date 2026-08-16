<script setup lang="ts">
/**
 * Movie Detail Page
 *
 * Full page view for movie detail, used by routing.
 */

import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { eq } from 'drizzle-orm'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Icon } from '@renderer/components/ui/icon'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { Separator } from '@renderer/components/ui/separator'
import { SpoilerConfirmDialog } from '@renderer/components/ui/spoiler-confirm-dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { MovieDetailContent, MovieWatchButton } from '@renderer/components/shared/movie'
import { EntityScoreFormDialog, EntityDropdownMenu } from '@renderer/components/shared/entity'
import { useAmbientLight, useEntityDetailRoute, useMovieRouteProvider } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { movies, type MovieStatus } from '@shared/db'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { formatMovieStatus, getMovieStatusVariant, getEntityIcon } from '@renderer/utils/format'

const { m } = useI18n()

// =============================================================================
// Constants
// =============================================================================

const STATUS_OPTIONS = computed<{ value: MovieStatus; label: string }[]>(() => [
  { value: 'planned', label: m.value.library.movieStatus.planned },
  { value: 'watching', label: m.value.library.movieStatus.watching },
  { value: 'completed', label: m.value.library.movieStatus.completed },
  { value: 'onHold', label: m.value.library.movieStatus.onHold },
  { value: 'dropped', label: m.value.library.movieStatus.dropped }
])

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()

const movieId = computed(() => route.params.movieId as string)

const { exit } = useEntityDetailRoute('movie', movieId)

// =============================================================================
// Provider (data settled during navigation by the route loader)
// =============================================================================

const { movie, error, spoilersRevealed } = useMovieRouteProvider()

const spoilerConfirmOpen = ref(false)

useAmbientLight(() =>
  movie.value?.coverFile
    ? getAttachmentUrl('movies', movie.value.id, movie.value.coverFile, {
        width: 100,
        height: 100
      })
    : null
)

// =============================================================================
// State
// =============================================================================

const scoreDialogOpen = ref(false)
const isPendingFavorite = ref(false)
const isPendingStatus = ref(false)

// =============================================================================
// Actions
// =============================================================================

async function handleToggleFavorite() {
  if (isPendingFavorite.value || !movie.value) return
  const current = movie.value
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

const selectedStatus = computed({
  get: () => movie.value?.status,
  set: async (status: MovieStatus | undefined) => {
    if (isPendingStatus.value || !movie.value || !status) return
    const current = movie.value
    isPendingStatus.value = true
    try {
      await db.update(movies).set({ status }).where(eq(movies.id, current.id))
      notify.success(m.value.library.feedback.statusUpdated)
    } catch {
      notify.error(m.value.library.feedback.updateFailed)
    } finally {
      isPendingStatus.value = false
    }
  }
})

async function handleOpenMovieDir() {
  const current = movie.value
  if (!current?.movieDirPath) {
    notify.error(m.value.movie.detail.movieDirNotSet)
    return
  }

  const result = await ipcManager.invoke('native:open-path', {
    path: current.movieDirPath,
    ensure: 'folder'
  })
  if (!result.success) {
    notify.error(m.value.movie.files.openFolderFailed)
  }
}
</script>

<template>
  <!-- Error / Not Found (data settles before navigation confirms) -->
  <StateView
    v-if="error"
    state="error"
    :error="error"
    class="h-full bg-background"
  />
  <StateView
    v-else-if="!movie"
    state="not-found"
    :icon="getEntityIcon('movie')"
    :title="m.library.detail.notFoundTitle({ label: m.library.entities.movie })"
    :description="m.library.detail.notFoundDescription({ label: m.library.entities.movie })"
    class="h-full bg-background"
  >
    <template #actions>
      <Button
        variant="secondary"
        @click="exit"
      >
        {{ m.app.notFound.backToLibrary }}
      </Button>
    </template>
  </StateView>

  <!-- Content -->
  <div
    v-else
    class="h-full flex flex-col"
  >
    <PageHeader>
      <PageHeaderTitle
        :title="movie.name"
        :icon="getEntityIcon('movie')"
      />

      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger as-child>
            <DropdownMenuTrigger as-child>
              <Badge
                :variant="getMovieStatusVariant(movie.status)"
                class="shrink-0 cursor-pointer"
              >
                {{ formatMovieStatus(movie.status) }}
              </Badge>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{{ m.movie.detail.watchStatus }}</TooltipContent>

          <DropdownMenuContent
            align="end"
            class="min-w-36"
          >
            <DropdownMenuRadioGroup v-model="selectedStatus">
              <DropdownMenuRadioItem
                v-for="option in STATUS_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </Tooltip>

      <template #actions>
        <Button
          variant="secondary"
          size="icon-sm"
          class="flex items-center py-0"
          :tooltip="m.library.detail.tooltips.score"
          @click="scoreDialogOpen = true"
        >
          <Icon
            icon="icon-[mdi--starburst-outline]"
            class="size-4"
          />
        </Button>

        <Button
          variant="secondary"
          size="icon-sm"
          :tooltip="m.movie.detail.openMovieDir"
          :disabled="!movie.movieDirPath"
          @click="handleOpenMovieDir"
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
            :class="movie.isFavorite ? 'size-4 text-destructive' : 'size-4'"
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
            :icon="spoilersRevealed ? 'icon-[mdi--eye-outline]' : 'icon-[mdi--eye-off-outline]'"
            class="size-4"
          />
        </Button>

        <Separator
          orientation="vertical"
          class="h-4"
        />

        <MovieWatchButton
          :movie-id="movie.id"
          size="sm"
        />
        <EntityDropdownMenu
          entity-type="movie"
          :entity-id="movie.id"
        >
          <Button
            variant="secondary"
            size="icon-sm"
          >
            <Icon
              icon="icon-[mdi--dots-horizontal]"
              class="size-4"
            />
          </Button>
        </EntityDropdownMenu>
      </template>
    </PageHeader>

    <div class="flex-1 overflow-auto bg-background p-4">
      <MovieDetailContent />
    </div>

    <!-- Score dialog -->
    <EntityScoreFormDialog
      v-if="scoreDialogOpen"
      v-model:open="scoreDialogOpen"
      entity-type="movie"
      :entity-id="movie.id"
    />

    <SpoilerConfirmDialog
      v-if="spoilerConfirmOpen"
      v-model:open="spoilerConfirmOpen"
      @confirm="handleRevealSpoilersConfirm"
    />
  </div>
</template>
