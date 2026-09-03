<script setup lang="ts">
/**
 * Anime Detail Page
 *
 * Full page view for anime detail, used by routing.
 */

import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { eq } from 'drizzle-orm'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
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
import {
  AnimeDetailContent,
  AnimeWatchButton,
  AnimeWatchCatchUpDialog
} from '@renderer/components/shared/anime'
import { EntityScoreFormDialog, EntityDropdownMenu } from '@renderer/components/shared/entity'
import { useAmbientLight, useAnimeRouteProvider, useEntityDetailRoute } from '@renderer/composables'
import { shouldOfferWatchCatchUp } from '@renderer/composables/anime-completion'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { animes, type MediaStatus } from '@shared/db'
import { getEntityImageUrl } from '@renderer/utils/entity-image'
import {
  formatMediaStatus,
  getEntityIcon,
  getMediaStatusOptions,
  getMediaStatusVariant
} from '@renderer/utils/format'

const log = createLogger('Library')

const { m } = useI18n()

// =============================================================================
// Constants
// =============================================================================

const STATUS_OPTIONS = computed(() => getMediaStatusOptions('anime'))

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()

const animeId = computed(() => route.params.animeId as string)

const { exit } = useEntityDetailRoute('anime', animeId)

// =============================================================================
// Provider (data committed by the route query before the page mounts)
// =============================================================================

const {
  anime,
  error,
  params: { spoilersRevealed }
} = useAnimeRouteProvider()

const spoilerConfirmOpen = ref(false)

useAmbientLight(() =>
  anime.value ? getEntityImageUrl('anime', anime.value, 'cover', { width: 100, height: 100 }) : null
)

// =============================================================================
// State
// =============================================================================

const scoreDialogOpen = ref(false)
const catchUpOpen = ref(false)
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
    notify.error(m.value.feedback.operationFailed)
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
  set: async (status: MediaStatus | undefined) => {
    if (isPendingStatus.value || !anime.value || !status) return
    const current = anime.value
    isPendingStatus.value = true
    try {
      await db.update(animes).set({ status }).where(eq(animes.id, current.id))
      notify.success(m.value.library.feedback.statusUpdated)
    } catch {
      notify.error(m.value.library.feedback.updateFailed)
      return
    } finally {
      isPendingStatus.value = false
    }

    try {
      catchUpOpen.value = await shouldOfferWatchCatchUp(current.id, status)
    } catch (error) {
      // The status change already succeeded; a missed offer is not worth a notice.
      log.warn('Episode catch-up offer check failed:', error)
    }
  }
})

async function handleOpenAnimeDir() {
  const current = anime.value
  if (!current?.dirPath) {
    notify.error(m.value.anime.detail.animeDirNotSet)
    return
  }

  const result = await ipcManager.invoke('native:open-path', {
    path: current.dirPath,
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
                :variant="getMediaStatusVariant(anime.status)"
                class="shrink-0 cursor-pointer"
              >
                {{ formatMediaStatus('anime', anime.status) }}
              </Badge>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{{ m.library.status.label.anime }}</TooltipContent>

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
          :disabled="!anime.dirPath"
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

    <ScrollRegion class="bg-background p-4">
      <AnimeDetailContent />
    </ScrollRegion>

    <!-- Score dialog -->
    <EntityScoreFormDialog
      v-if="scoreDialogOpen"
      v-model:open="scoreDialogOpen"
      entity-type="anime"
      :entity-id="anime.id"
    />

    <AnimeWatchCatchUpDialog
      v-if="catchUpOpen"
      v-model:open="catchUpOpen"
      :anime-id="anime.id"
    />

    <SpoilerConfirmDialog
      v-if="spoilerConfirmOpen"
      v-model:open="spoilerConfirmOpen"
      @confirm="handleRevealSpoilersConfirm"
    />
  </div>
</template>
