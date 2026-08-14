<script setup lang="ts">
/**
 * Anime Detail Page
 *
 * Full page view for anime detail, used by routing.
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
import { AnimeDetailContent, AnimeWatchButton } from '@renderer/components/shared/anime'
import { EntityScoreFormDialog, EntityDropdownMenu } from '@renderer/components/shared/entity'
import { useAmbientLight, useAnimeRouteProvider, useEntityDetailRoute } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { animes, type AnimeStatus } from '@shared/db'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { formatAnimeStatus, getAnimeStatusVariant, getEntityIcon } from '@renderer/utils/format'

const { m } = useI18n()

// =============================================================================
// Constants
// =============================================================================

const STATUS_OPTIONS = computed<{ value: AnimeStatus; label: string }[]>(() => [
  { value: 'planned', label: m.value.library.animeStatus.planned },
  { value: 'watching', label: m.value.library.animeStatus.watching },
  { value: 'completed', label: m.value.library.animeStatus.completed },
  { value: 'onHold', label: m.value.library.animeStatus.onHold },
  { value: 'dropped', label: m.value.library.animeStatus.dropped }
])

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()

const animeId = computed(() => route.params.animeId as string)

const { exit } = useEntityDetailRoute('anime', animeId)

// =============================================================================
// Provider (data settled during navigation by the route loader)
// =============================================================================

const { anime, error, spoilersRevealed } = useAnimeRouteProvider()

const spoilerConfirmOpen = ref(false)

useAmbientLight(() =>
  anime.value?.coverFile
    ? getAttachmentUrl('animes', anime.value.id, anime.value.coverFile, { width: 100, height: 100 })
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
  if (isPendingFavorite.value || !anime.value) return
  const current = anime.value
  isPendingFavorite.value = true
  try {
    await db
      .update(animes)
      .set({ isFavorite: !current.isFavorite })
      .where(eq(animes.id, current.id))
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
  get: () => anime.value?.status,
  set: async (status: AnimeStatus | undefined) => {
    if (isPendingStatus.value || !anime.value || !status) return
    const current = anime.value
    isPendingStatus.value = true
    try {
      await db.update(animes).set({ status }).where(eq(animes.id, current.id))
      notify.success(m.value.library.feedback.statusUpdated)
    } catch {
      notify.error(m.value.library.feedback.updateFailed)
    } finally {
      isPendingStatus.value = false
    }
  }
})

async function handleOpenAnimeDir() {
  const current = anime.value
  if (!current?.animeDirPath) {
    notify.error(m.value.anime.detail.animeDirNotSet)
    return
  }

  const result = await ipcManager.invoke('native:open-path', {
    path: current.animeDirPath,
    ensure: 'folder'
  })
  if (!result.success) {
    notify.error(m.value.anime.files.openFolderFailed)
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
    v-else-if="!anime"
    state="not-found"
    :icon="getEntityIcon('anime')"
    :title="m.library.detail.notFoundTitle({ label: m.library.entities.anime })"
    :description="m.library.detail.notFoundDescription({ label: m.library.entities.anime })"
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
        :title="anime.name"
        :icon="getEntityIcon('anime')"
      />

      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger as-child>
            <DropdownMenuTrigger as-child>
              <Badge
                :variant="getAnimeStatusVariant(anime.status)"
                class="shrink-0 cursor-pointer"
              >
                {{ formatAnimeStatus(anime.status) }}
              </Badge>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{{ m.anime.detail.watchStatus }}</TooltipContent>

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
          :tooltip="m.anime.detail.openAnimeDir"
          :disabled="!anime.animeDirPath"
          @click="handleOpenAnimeDir"
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
            anime.isFavorite
              ? m.library.detail.tooltips.favoriteRemove
              : m.library.detail.tooltips.favoriteAdd
          "
          :disabled="isPendingFavorite"
          @click="handleToggleFavorite"
        >
          <Icon
            icon="icon-[mdi--heart-outline]"
            :class="anime.isFavorite ? 'size-4 text-destructive' : 'size-4'"
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

        <AnimeWatchButton
          :anime-id="anime.id"
          size="sm"
        />
        <EntityDropdownMenu
          entity-type="anime"
          :entity-id="anime.id"
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
      <AnimeDetailContent />
    </div>

    <!-- Score dialog -->
    <EntityScoreFormDialog
      v-if="scoreDialogOpen"
      v-model:open="scoreDialogOpen"
      entity-type="anime"
      :entity-id="anime.id"
    />

    <SpoilerConfirmDialog
      v-if="spoilerConfirmOpen"
      v-model:open="spoilerConfirmOpen"
      @confirm="handleRevealSpoilersConfirm"
    />
  </div>
</template>
