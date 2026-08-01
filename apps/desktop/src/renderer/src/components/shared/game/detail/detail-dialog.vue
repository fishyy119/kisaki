<!--
  Game Detail Dialog

  Dialog view for game details.
  Used when viewing a game outside the library context.
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { getEntityIcon } from '@renderer/utils/format'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { games } from '@shared/db'
import { eq } from 'drizzle-orm'
import { useGameDialogProvider } from '@renderer/composables/use-game'
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
import GameDetailContent from './detail-content.vue'
import GamePlayButton from '../game-play-button.vue'
import { GameScoreFormDialog } from '../forms'
import { GameDropdownMenu } from '../menus'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

// =============================================================================
// Props & Model
// =============================================================================

const props = defineProps<{
  gameId: string
}>()

const open = defineModel<boolean>('open', { default: false })

// =============================================================================
// Game Context (Provider)
// =============================================================================

const gameId = computed(() => props.gameId)
const { game, isLoading, error, spoilersRevealed } = useGameDialogProvider(gameId)
const state = useRenderState(isLoading, error, game)

const spoilerConfirmOpen = ref(false)

useDbChanges(({ operation, table, id }) => {
  if (operation !== 'deleted') return
  if (table === 'games' && id === props.gameId) {
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
  const current = game.value!
  isPendingFavorite.value = true
  try {
    await db.update(games).set({ isFavorite: !current.isFavorite }).where(eq(games.id, current.id))
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
  const current = game.value!
  const pathToOpen =
    current.gameDirPath || (current.launcherMode === 'file' ? current.launcherPath : null)
  if (!pathToOpen) {
    notify.error(m.value.library.feedback.gameDirNotSet)
    return
  }
  await ipcManager.invoke('native:open-path', { path: pathToOpen, ensure: 'folder' })
}

const canOpenGameDir = computed(() => {
  if (state.value !== 'success') return false
  const current = game.value
  if (!current) return false
  return !!(current.gameDirPath || (current.launcherMode === 'file' && current.launcherPath))
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
            :icon="getEntityIcon('game')"
            :title="m.library.detail.notFoundTitle({ label: m.library.entities.game })"
            :description="m.library.detail.notFoundDescription({ label: m.library.entities.game })"
            class="py-12"
          />
        </DialogBody>
      </template>

      <!-- Loaded Content -->
      <template v-else-if="game">
        <DialogHeader>
          <DialogTitle>{{ game.name }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="flex-1 min-h-0 overflow-auto p-4">
          <GameDetailContent />
        </DialogBody>
        <DialogFooter>
          <div class="flex items-center justify-between w-full">
            <!-- Left: Play button and stats -->
            <GamePlayButton
              :game-id="game.id"
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
                :disabled="!canOpenGameDir"
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
                  game.isFavorite
                    ? m.library.detail.tooltips.favoriteRemove
                    : m.library.detail.tooltips.favoriteAdd
                "
                :disabled="isPendingFavorite"
                @click="handleToggleFavorite"
              >
                <Icon
                  icon="icon-[mdi--heart-outline]"
                  class="size-4"
                  :class="game.isFavorite ? 'text-destructive' : ''"
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

              <GameDropdownMenu :game-id="game.id" />
            </div>
          </div>
        </DialogFooter>

        <!-- Score Dialog -->
        <GameScoreFormDialog
          v-if="isScoreOpen"
          v-model:open="isScoreOpen"
          :game-id="game.id"
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
