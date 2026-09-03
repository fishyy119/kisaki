<script setup lang="ts">
/**
 * Game Detail Page
 *
 * Full page view for game detail, used by routing.
 */

import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { ScrollRegion } from '@renderer/components/ui/scroll-region'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { PageHeader, PageHeaderTitle } from '@renderer/components/ui/page-header'
import { Separator } from '@renderer/components/ui/separator'
import { StateView } from '@renderer/components/ui/state-view'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { SpoilerConfirmDialog } from '@renderer/components/ui/spoiler-confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { GamePlayButton, GameDetailContent } from '@renderer/components/shared/game'
import { EntityScoreFormDialog, EntityDropdownMenu } from '@renderer/components/shared/entity'
import { useAmbientLight, useEntityDetailRoute, useGameRouteProvider } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import { games, type MediaStatus } from '@shared/db'
import { getEntityImageUrl } from '@renderer/utils/entity-image'
import {
  formatMediaStatus,
  getEntityIcon,
  getMediaStatusOptions,
  getMediaStatusVariant
} from '@renderer/utils/format'

const { m } = useI18n()

// =============================================================================
// Constants
// =============================================================================

const STATUS_OPTIONS = computed(() => getMediaStatusOptions('game'))

// =============================================================================
// Route & Navigation
// =============================================================================

const route = useRoute()

const gameId = computed(() => route.params.gameId as string)

const { exit } = useEntityDetailRoute('game', gameId)

// =============================================================================
// Provider (data settled during navigation by the route loader)
// =============================================================================

const {
  game,
  error,
  params: { spoilersRevealed }
} = useGameRouteProvider()

const spoilerConfirmOpen = ref(false)

useAmbientLight(() =>
  game.value ? getEntityImageUrl('game', game.value, 'cover', { width: 100, height: 100 }) : null
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
  if (isPendingFavorite.value || !game.value) return
  const current = game.value
  isPendingFavorite.value = true
  try {
    await db.update(games).set({ isFavorite: !current.isFavorite }).where(eq(games.id, current.id))
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

// Status as a computed to track dropdown value
const selectedStatus = computed({
  get: () => game.value?.status,
  set: async (status: MediaStatus | undefined) => {
    if (isPendingStatus.value || !game.value || !status) return
    const current = game.value
    isPendingStatus.value = true
    try {
      await db.update(games).set({ status }).where(eq(games.id, current.id))
      notify.success(m.value.library.feedback.statusUpdated)
    } catch {
      notify.error(m.value.library.feedback.updateFailed)
    } finally {
      isPendingStatus.value = false
    }
  }
})

async function handleOpenGameDir() {
  if (!game.value) return
  const current = game.value
  const pathToOpen =
    current.dirPath || (current.launcherMode === 'file' ? current.launcherPath : null)
  if (!pathToOpen) {
    notify.error(m.value.library.feedback.gameDirNotSet)
    return
  }
  const result = await ipcManager.invoke('native:open-path', { path: pathToOpen, ensure: 'folder' })
  if (!result.success) {
    notify.error(m.value.library.feedback.openGameDirFailed)
  }
}

const canOpenGameDir = computed(() => {
  const current = game.value
  if (!current) return false
  return !!(current.dirPath || (current.launcherMode === 'file' && current.launcherPath))
})
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
    v-else-if="!game"
    state="not-found"
    :icon="getEntityIcon('game')"
    :title="m.library.detail.notFoundTitle({ label: m.library.entities.game })"
    :description="m.library.detail.notFoundDescription({ label: m.library.entities.game })"
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
    <!-- Header -->
    <PageHeader>
      <PageHeaderTitle
        :title="game.name"
        :icon="getEntityIcon('game')"
      />

      <!-- Status dropdown -->
      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger as-child>
            <DropdownMenuTrigger as-child>
              <Badge
                :variant="getMediaStatusVariant(game.status)"
                class="shrink-0 cursor-pointer"
              >
                {{ formatMediaStatus('game', game.status) }}
              </Badge>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{{ m.library.status.label.game }}</TooltipContent>

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
          :tooltip="m.library.menu.openGameDir"
          :disabled="!canOpenGameDir"
          @click="handleOpenGameDir"
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
            game.isFavorite
              ? m.library.detail.tooltips.favoriteRemove
              : m.library.detail.tooltips.favoriteAdd
          "
          :disabled="isPendingFavorite"
          @click="handleToggleFavorite"
        >
          <Icon
            icon="icon-[mdi--heart-outline]"
            :class="game.isFavorite ? 'size-4 text-destructive' : 'size-4'"
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

        <GamePlayButton
          :game-id="game.id"
          size="sm"
        />
        <EntityDropdownMenu
          entity-type="game"
          :entity-id="game.id"
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

    <!-- Main content -->
    <ScrollRegion
      :memory="route.path"
      class="bg-background p-4"
    >
      <GameDetailContent />
    </ScrollRegion>

    <!-- Score dialog -->
    <EntityScoreFormDialog
      v-if="scoreDialogOpen"
      v-model:open="scoreDialogOpen"
      entity-type="game"
      :entity-id="game.id"
    />

    <SpoilerConfirmDialog
      v-if="spoilerConfirmOpen"
      v-model:open="spoilerConfirmOpen"
      @confirm="handleRevealSpoilersConfirm"
    />
  </div>
</template>
