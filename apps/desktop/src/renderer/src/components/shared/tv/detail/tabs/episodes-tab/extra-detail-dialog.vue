<!--
  TvExtraDetailDialog
  Workbench for one extra, mirroring the episode detail dialog: identity,
  playback controls, and immediate file record management. Staged field edits
  live in the extra form dialog opened from the footer. Manual attachment
  creates user-owned rows; disk files are never touched here.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { eq } from 'drizzle-orm'
import { Button } from '@renderer/components/ui/button'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Icon } from '@renderer/components/ui/icon'
import { useI18n } from '@renderer/composables/use-i18n'
import { useTv, type TvExtraEntry } from '@renderer/composables/use-tv'
import { useTvExtraPlayback } from '@renderer/composables/use-tv-extra-playback'
import { revealTvFile, useTvFileRecords } from '@renderer/composables/use-tv-file-records'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { tvExtraFiles, tvExtras } from '@shared/db'
import TvExtraFormDialog from './extra-form-dialog.vue'
import TvFileRecordList from './file-record-list.vue'
import { MediaPlaybackProgress } from '@renderer/components/shared/media'

const log = createLogger('Tv')

interface Props {
  tvId: string
  extraId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()
const { extras } = useTv()

const extra = computed<TvExtraEntry | null>(
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
} = useTvExtraPlayback(() => props.extraId)

const hasPlayableFile = computed(() => (extra.value?.files.length ?? 0) > 0)

// =============================================================================
// File records (immediate semantics; alternate versions of the same asset)
// =============================================================================

const { isAttaching, attachFile, setPrimary, removeFile, saveNote } = useTvFileRecords({
  owner: extra,
  table: tvExtraFiles,
  ownerColumn: tvExtraFiles.extraId,
  attach: (extraId, path) =>
    ipcManager.invoke('ingest:attach-tv-extra-file', { tvId: props.tvId, path, extraId })
})

// =============================================================================
// Deletion (record only; sync re-creates in-library files it still owns)
// =============================================================================

async function handleDelete(): Promise<void> {
  const entry = extra.value
  if (!entry) return
  try {
    await db.delete(tvExtras).where(eq(tvExtras.id, entry.id))
    notify.success(m.value.tv.extras.extraRemoved)
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
              {{ m.library.tvExtraType[extra.type] }}
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
          <TvFileRecordList
            :files="extra.files"
            :empty-text="m.tv.files.noFiles"
            :attaching="isAttaching"
            @attach="attachFile"
            @play="play"
            @set-primary="setPrimary"
            @remove-file="removeFile"
            @open-folder="revealTvFile"
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
                {{ m.tv.stop }}
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
                {{ m.tv.extras.play }}
              </Button>

              <Button
                v-if="isPlaying"
                variant="secondary"
                size="icon-sm"
                :disabled="isPauseActionPending"
                :tooltip="isPaused ? m.tv.player.resume : m.tv.player.pause"
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
                :tooltip="m.tv.extras.editTitle"
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
                :tooltip="m.tv.extras.deleteExtra"
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
  <TvExtraFormDialog
    v-if="editDialogOpen && extra"
    v-model:open="editDialogOpen"
    :tv-id="props.tvId"
    :extra="extra"
  />

  <!-- Delete extra confirmation -->
  <DeleteConfirmDialog
    v-if="deleteDialogOpen && extra"
    v-model:open="deleteDialogOpen"
    :entity-label="m.tv.extras.entityLabel"
    :entity-name="extra.name"
    @confirm="handleDelete"
  />
</template>
