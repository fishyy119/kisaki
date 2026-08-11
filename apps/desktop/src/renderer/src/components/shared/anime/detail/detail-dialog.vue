<!--
  Anime Detail Dialog

  Dialog view for anime details.
  Used when viewing an anime outside the library context.
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { getEntityIcon } from '@renderer/utils/format'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { animes } from '@shared/db'
import { eq } from 'drizzle-orm'
import { useAnimeDialogProvider } from '@renderer/composables/use-anime'
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
import AnimeDetailContent from './detail-content.vue'
import AnimeWatchButton from '../anime-watch-button.vue'
import { AnimeScoreFormDialog } from '../forms'
import { AnimeDropdownMenu } from '../menus'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

// =============================================================================
// Props & Model
// =============================================================================

const props = defineProps<{
  animeId: string
}>()

const open = defineModel<boolean>('open', { default: false })

// =============================================================================
// Anime Context (Provider)
// =============================================================================

const animeId = computed(() => props.animeId)
const { anime, isLoading, error, spoilersRevealed } = useAnimeDialogProvider(animeId)
const state = useRenderState(isLoading, error, anime)

const spoilerConfirmOpen = ref(false)

useDbChanges(({ operation, table, id }) => {
  if (operation !== 'deleted') return
  if (table === 'animes' && id === props.animeId) {
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
  const current = anime.value!
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

async function handleOpenFolder() {
  if (state.value !== 'success') return
  const current = anime.value!
  if (!current.animeDirPath) {
    notify.error(m.value.anime.detail.animeDirNotSet)
    return
  }
  await ipcManager.invoke('native:open-path', { path: current.animeDirPath, ensure: 'folder' })
}

const canOpenAnimeDir = computed(() => {
  if (state.value !== 'success') return false
  return !!anime.value?.animeDirPath
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
            :icon="getEntityIcon('anime')"
            :title="m.library.detail.notFoundTitle({ label: m.library.entities.anime })"
            :description="
              m.library.detail.notFoundDescription({ label: m.library.entities.anime })
            "
            class="py-12"
          />
        </DialogBody>
      </template>

      <!-- Loaded Content -->
      <template v-else-if="anime">
        <DialogHeader>
          <DialogTitle>{{ anime.name }}</DialogTitle>
        </DialogHeader>
        <DialogBody class="flex-1 min-h-0 overflow-auto p-4">
          <AnimeDetailContent />
        </DialogBody>
        <DialogFooter>
          <div class="flex items-center justify-between w-full">
            <!-- Left: Watch button -->
            <AnimeWatchButton
              :anime-id="anime.id"
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
                :disabled="!canOpenAnimeDir"
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
                  anime.isFavorite
                    ? m.library.detail.tooltips.favoriteRemove
                    : m.library.detail.tooltips.favoriteAdd
                "
                :disabled="isPendingFavorite"
                @click="handleToggleFavorite"
              >
                <Icon
                  icon="icon-[mdi--heart-outline]"
                  class="size-4"
                  :class="anime.isFavorite ? 'text-destructive' : ''"
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

              <AnimeDropdownMenu :anime-id="anime.id" />
            </div>
          </div>
        </DialogFooter>

        <!-- Score Dialog -->
        <AnimeScoreFormDialog
          v-if="isScoreOpen"
          v-model:open="isScoreOpen"
          :anime-id="anime.id"
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
