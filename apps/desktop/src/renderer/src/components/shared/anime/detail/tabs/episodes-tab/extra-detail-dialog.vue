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
import { revealAnimeFile, useAnimeFileRecords } from '@renderer/composables/use-anime-file-records'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { animeExtraFiles, animeExtras } from '@shared/db'
import AnimeExtraFormDialog from './extra-form-dialog.vue'
import AnimeFileRecordList from './file-record-list.vue'
import { MediaPlaybackProgress } from '@renderer/components/shared/media'

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

const { isAttaching, attachFile, setPrimary, removeFile, saveNote } = useAnimeFileRecords({
  owner: extra,
  table: animeExtraFiles,
  ownerColumn: animeExtraFiles.extraId,
  attach: (extraId, path) =>
    ipcManager.invoke('media-files:attach-anime-extra-file', {
      animeId: props.animeId,
      path,
      extraId
    })
})

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
            <span class="font-mono text-muted-foreground shrink-0">
              {{ m.library.animeExtraType[extra.type] }}
            </span>
            <span class="truncate">{{ extra.name }}</span>
          </DialogTitle>
        </DialogHeader>

        <DialogBody class="flex-1 min-h-0 overflow-auto space-y-4">
          <!-- Live playback progress -->
          <MediaPlaybackProgress
            v-if="isPlaying"
            :status="playbackStatus"
            :progress="playbackProgress"
          />

          <!-- Files -->
          <AnimeFileRecordList
            :files="extra.files"
            :empty-text="m.anime.files.noFiles"
            :attaching="isAttaching"
            @attach="attachFile"
            @play="play"
            @set-primary="setPrimary"
            @remove-file="removeFile"
            @open-folder="revealAnimeFile"
            @save-note="saveNote"
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
