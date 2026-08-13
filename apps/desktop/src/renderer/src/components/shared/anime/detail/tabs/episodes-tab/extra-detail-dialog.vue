<!--
  AnimeExtraDetailDialog
  Workbench for one extra, mirroring the episode detail dialog: identity,
  playback controls, and immediate file record management. Staged field edits
  live in the extra form dialog opened from the footer. Manual attachment
  creates user-owned rows; disk files are never touched here.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { eq } from 'drizzle-orm'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { useAnime, type AnimeExtraEntry } from '@renderer/composables/use-anime'
import { useAnimeExtraPlayback } from '@renderer/composables/use-anime-extra-playback'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { getOpenVideoDialogOptions } from '@renderer/utils/dialog'
import { animeExtraFiles, animeExtras, type AnimeExtraFile } from '@shared/db'
import AnimeExtraFormDialog from './extra-form-dialog.vue'
import AnimeFileRecordList from './file-record-list.vue'
import AnimePlaybackProgress from './playback-progress.vue'

const log = createLogger('Anime')

interface Props {
  animeId: string
  extraId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()
const { extras } = useAnime()

const extra = computed<AnimeExtraEntry | null>(
  () => extras.value.find((entry) => entry.id === props.extraId) ?? null
)

const editDialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const isAttachingFile = ref(false)

// =============================================================================
// Playback
// =============================================================================

const {
  isPlaying,
  playbackStatus,
  playbackProgress,
  isPaused,
  isPauseActionPending,
  togglePause,
  isActionPending,
  play,
  stop
} = useAnimeExtraPlayback(() => props.extraId)

const hasPlayableFile = computed(() => (extra.value?.files.length ?? 0) > 0)

// =============================================================================
// File records (immediate semantics; alternate versions of the same asset)
// =============================================================================

async function handleAttachFile(): Promise<void> {
  const entry = extra.value
  if (!entry || isAttachingFile.value) return

  isAttachingFile.value = true
  try {
    const dialogResult = await ipcManager.invoke('native:open-dialog', getOpenVideoDialogOptions())
    if (!dialogResult.success) {
      notify.error(dialogResult.error || m.value.library.feedback.pickFileFailed)
      return
    }
    const picked = dialogResult.data?.filePaths[0]
    if (!picked || dialogResult.data?.canceled) return

    const result = await ipcManager.invoke('ingest:attach-anime-extra-file', {
      animeId: props.animeId,
      path: picked,
      extraId: entry.id
    })
    if (!result.success) {
      notify.error(m.value.anime.files.attachFailed, result.error)
      return
    }

    notify.success(m.value.anime.files.fileAttached)
  } finally {
    isAttachingFile.value = false
  }
}

async function handleSetPrimary(file: Pick<AnimeExtraFile, 'id' | 'isPrimary'>): Promise<void> {
  const entry = extra.value
  if (!entry || file.isPrimary) return
  try {
    await db
      .update(animeExtraFiles)
      .set({ isPrimary: false })
      .where(eq(animeExtraFiles.extraId, entry.id))
    await db.update(animeExtraFiles).set({ isPrimary: true }).where(eq(animeExtraFiles.id, file.id))
    notify.success(m.value.anime.files.primaryUpdated)
  } catch (error) {
    log.error('Set primary file failed:', error)
    notify.error(m.value.library.feedback.updateFailed)
  }
}

async function handleRemoveFile(fileId: string): Promise<void> {
  const entry = extra.value
  if (!entry) return
  try {
    const removed = entry.files.find((file) => file.id === fileId)
    await db.delete(animeExtraFiles).where(eq(animeExtraFiles.id, fileId))

    // Keep exactly one primary among the survivors.
    if (removed?.isPrimary) {
      const survivor = entry.files.find((file) => file.id !== fileId)
      if (survivor) {
        await db
          .update(animeExtraFiles)
          .set({ isPrimary: true })
          .where(eq(animeExtraFiles.id, survivor.id))
      }
    }

    notify.success(m.value.anime.files.fileRemoved)
  } catch (error) {
    log.error('Remove file record failed:', error)
    notify.error(m.value.common.deleteFailed)
  }
}

async function handleSaveNote(fileId: string, note: string | null): Promise<void> {
  try {
    await db.update(animeExtraFiles).set({ note }).where(eq(animeExtraFiles.id, fileId))
    notify.success(m.value.anime.files.noteSaved)
  } catch (error) {
    log.error('File note update failed:', error)
    notify.error(m.value.library.feedback.updateFailed)
  }
}

async function handleOpenFolder(path: string): Promise<void> {
  const result = await ipcManager.invoke('native:open-path', { path, ensure: 'file' })
  if (!result.success) {
    notify.error(m.value.anime.files.openFolderFailed)
  }
}

// =============================================================================
// Deletion (record only; sync re-creates in-library files it still owns)
// =============================================================================

async function handleDelete(): Promise<void> {
  const entry = extra.value
  if (!entry) return
  try {
    await db.delete(animeExtras).where(eq(animeExtras.id, entry.id))
    notify.success(m.value.anime.extras.extraRemoved)
    open.value = false
  } catch (error) {
    log.error('Extra delete failed:', error)
    notify.error(m.value.common.deleteFailed)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl max-h-[85vh] flex flex-col">
      <template v-if="extra">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2 min-w-0">
            <span class="truncate">{{ extra.name }}</span>
            <Badge
              variant="secondary"
              class="shrink-0"
            >
              {{ m.library.animeExtraType[extra.type] }}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <DialogBody class="flex-1 min-h-0 overflow-auto space-y-4">
          <!-- Live playback progress -->
          <AnimePlaybackProgress
            v-if="isPlaying"
            :status="playbackStatus"
            :progress="playbackProgress"
          />

          <!-- Files -->
          <AnimeFileRecordList
            :files="extra.files"
            :empty-text="m.anime.files.noFiles"
            :attaching="isAttachingFile"
            @attach="handleAttachFile"
            @play="play"
            @set-primary="handleSetPrimary"
            @remove-file="handleRemoveFile"
            @open-folder="handleOpenFolder"
            @save-note="handleSaveNote"
          />
        </DialogBody>

        <DialogFooter>
          <div class="flex items-center justify-between w-full">
            <div class="flex items-center gap-1.5">
              <Button
                v-if="isPlaying"
                variant="secondary"
                size="sm"
                :disabled="isActionPending"
                @click="stop"
              >
                <Icon
                  icon="icon-[mdi--stop]"
                  class="size-4 mr-1.5"
                />
                {{ m.anime.stop }}
              </Button>
              <Button
                v-else
                variant="secondary"
                size="sm"
                :disabled="isActionPending || !hasPlayableFile"
                @click="play()"
              >
                <Icon
                  icon="icon-[mdi--play]"
                  class="size-4 mr-1.5"
                />
                {{ m.anime.extras.play }}
              </Button>

              <Button
                v-if="isPlaying"
                variant="secondary"
                size="icon-sm"
                :disabled="isPauseActionPending"
                :tooltip="isPaused ? m.anime.player.resume : m.anime.player.pause"
                @click="togglePause"
              >
                <Icon
                  :icon="isPaused ? 'icon-[mdi--play]' : 'icon-[mdi--pause]'"
                  class="size-4"
                />
              </Button>
            </div>

            <div class="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="icon-sm"
                :tooltip="m.anime.extras.editTitle"
                @click="editDialogOpen = true"
              >
                <Icon
                  icon="icon-[mdi--pencil-outline]"
                  class="size-4"
                />
              </Button>

              <Button
                variant="secondary"
                size="icon-sm"
                class="text-destructive hover:text-destructive"
                :tooltip="m.anime.extras.deleteExtra"
                @click="deleteDialogOpen = true"
              >
                <Icon
                  icon="icon-[mdi--delete-outline]"
                  class="size-4"
                />
              </Button>
            </div>
          </div>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>

  <!-- Edit extra -->
  <AnimeExtraFormDialog
    v-if="editDialogOpen && extra"
    v-model:open="editDialogOpen"
    :anime-id="props.animeId"
    :extra="extra"
  />

  <!-- Delete extra confirmation -->
  <DeleteConfirmDialog
    v-if="deleteDialogOpen && extra"
    v-model:open="deleteDialogOpen"
    :entity-label="m.anime.extras.entityLabel"
    :entity-name="extra.name"
    @confirm="handleDelete"
  />
</template>
