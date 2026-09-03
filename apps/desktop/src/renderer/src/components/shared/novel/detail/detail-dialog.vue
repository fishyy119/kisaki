<!--
  Novel Detail Dialog

  Dialog view for novel details.
  Used when viewing a novel outside the library context.
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { getEntityIcon } from '@renderer/utils/format'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { novels } from '@shared/db'
import { eq } from 'drizzle-orm'
import { useNovelDialogProvider } from '@renderer/composables/use-novel'
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
import NovelDetailContent from './detail-content.vue'
import NovelReadButton from '../novel-read-button.vue'
import { EntityScoreFormDialog, EntityDropdownMenu } from '@renderer/components/shared/entity'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

// =============================================================================
// Props & Model
// =============================================================================

const props = defineProps<{
  entityId: string
}>()

const open = defineModel<boolean>('open', { default: false })

// =============================================================================
// Novel Context (Provider)
// =============================================================================

const novelId = computed(() => props.entityId)
const {
  novel,
  isLoading,
  error,
  params: { spoilersRevealed }
} = useNovelDialogProvider(novelId)
const state = useRenderState(isLoading, error, novel)

const spoilerConfirmOpen = ref(false)

useDbChanges(({ changes }) => {
  const deleted = changes.some(
    (change) =>
      change.operation === 'deleted' && change.table === 'novels' && change.id === props.entityId
  )
  if (deleted) open.value = false
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
  const current = novel.value!
  isPendingFavorite.value = true
  try {
    await db
      .update(novels)
      .set({ isFavorite: !current.isFavorite })
      .where(eq(novels.id, current.id))
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

async function handleOpenFolder() {
  if (state.value !== 'success') return
  const current = novel.value!
  if (!current.dirPath) {
    notify.error(m.value.novel.detail.novelDirNotSet)
    return
  }
  await ipcManager.invoke('native:open-path', { path: current.dirPath, ensure: 'folder' })
}

const canOpenNovelDir = computed(() => {
  if (state.value !== 'success') return false
  return !!novel.value?.dirPath
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      size="xl"
      fill
    >
      <!-- Loading / Error / Not Found -->
      <template v-if="state !== 'success'">
        <DialogBody>
          <StateView
            :state="state"
            :error="error"
            :icon="getEntityIcon('novel')"
            :title="m.library.detail.notFoundTitle({ label: m.library.entities.novel })"
            :description="m.library.detail.notFoundDescription({ label: m.library.entities.novel })"
            class="h-full"
          />
        </DialogBody>
      </template>

      <!-- Loaded Content -->
      <template v-else-if="novel">
        <DialogHeader>
          <DialogTitle :icon="getEntityIcon('novel')">
            {{ novel.name }}
          </DialogTitle>
        </DialogHeader>
        <DialogBody class="p-4">
          <NovelDetailContent />
        </DialogBody>
        <DialogFooter>
          <div class="flex items-center justify-between w-full">
            <!-- Left: Read button -->
            <NovelReadButton
              :novel-id="novel.id"
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
                :disabled="!canOpenNovelDir"
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
                  novel.isFavorite
                    ? m.library.detail.tooltips.favoriteRemove
                    : m.library.detail.tooltips.favoriteAdd
                "
                :disabled="isPendingFavorite"
                @click="handleToggleFavorite"
              >
                <Icon
                  icon="icon-[mdi--heart-outline]"
                  class="size-4"
                  :class="novel.isFavorite ? 'text-destructive' : ''"
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
                entity-type="novel"
                :entity-id="novel.id"
              />
            </div>
          </div>
        </DialogFooter>

        <!-- Score Dialog -->
        <EntityScoreFormDialog
          v-if="isScoreOpen"
          v-model:open="isScoreOpen"
          entity-type="novel"
          :entity-id="novel.id"
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
