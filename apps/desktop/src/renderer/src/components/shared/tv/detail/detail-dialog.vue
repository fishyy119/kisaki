<!--
  Tv Detail Dialog

  Dialog view for series details.
  Used when viewing a series outside the library context.
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { getEntityIcon } from '@renderer/utils/format'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { tvs } from '@shared/db'
import { eq } from 'drizzle-orm'
import { useTvDialogProvider } from '@renderer/composables/use-tv'
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
import TvDetailContent from './detail-content.vue'
import TvWatchButton from '../tv-watch-button.vue'
import { EntityScoreFormDialog, EntityDropdownMenu } from '@renderer/components/shared/entity'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

// =============================================================================
// Props & Model
// =============================================================================

const props = defineProps<{
  tvId: string
}>()

const open = defineModel<boolean>('open', { default: false })

// =============================================================================
// Tv Context (Provider)
// =============================================================================

const tvId = computed(() => props.tvId)
const { tv, isLoading, error, spoilersRevealed } = useTvDialogProvider(tvId)
const state = useRenderState(isLoading, error, tv)

const spoilerConfirmOpen = ref(false)

useDbChanges(({ operation, table, id }) => {
  if (operation !== 'deleted') return
  if (table === 'tvs' && id === props.tvId) {
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
  const current = tv.value!
  isPendingFavorite.value = true
  try {
    await db.update(tvs).set({ isFavorite: !current.isFavorite }).where(eq(tvs.id, current.id))
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
  const current = tv.value!
  if (!current.tvDirPath) {
    notify.error(m.value.tv.detail.tvDirNotSet)
    return
  }
  await ipcManager.invoke('native:open-path', { path: current.tvDirPath, ensure: 'folder' })
}

const canOpenTvDir = computed(() => {
  if (state.value !== 'success') return false
  return !!tv.value?.tvDirPath
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
            :icon="getEntityIcon('tv')"
            :title="m.library.detail.notFoundTitle({ label: m.library.entities.tv })"
            :description="m.library.detail.notFoundDescription({ label: m.library.entities.tv })"
            class="py-12"
          />
        </DialogBody>
      </template>

      <!-- Loaded Content -->
      <template v-else-if="tv">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Icon
              :icon="getEntityIcon('tv')"
              class="size-4 text-muted-foreground"
            />
            {{ tv.name }}
          </DialogTitle>
        </DialogHeader>
        <DialogBody class="flex-1 min-h-0 overflow-auto p-4">
          <TvDetailContent />
        </DialogBody>
        <DialogFooter>
          <div class="flex items-center justify-between w-full">
            <!-- Left: Watch button -->
            <TvWatchButton
              :tv-id="tv.id"
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
                :disabled="!canOpenTvDir"
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
                  tv.isFavorite
                    ? m.library.detail.tooltips.favoriteRemove
                    : m.library.detail.tooltips.favoriteAdd
                "
                :disabled="isPendingFavorite"
                @click="handleToggleFavorite"
              >
                <Icon
                  icon="icon-[mdi--heart-outline]"
                  class="size-4"
                  :class="tv.isFavorite ? 'text-destructive' : ''"
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
                entity-type="tv"
                :entity-id="tv.id"
              />
            </div>
          </div>
        </DialogFooter>

        <!-- Score Dialog -->
        <EntityScoreFormDialog
          v-if="isScoreOpen"
          v-model:open="isScoreOpen"
          entity-type="tv"
          :entity-id="tv.id"
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
