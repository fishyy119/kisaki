<!--
  AnimeEpisodeDetailDialog
  Full detail view for one episode: metadata, watch state, and the playable
  file records. Manual attachment creates user-owned rows; primary election
  and record removal act on sync-owned rows too (sync keeps a surviving
  primary preference, and removed in-library records reappear on the next
  sync pass). Disk files are never touched here.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
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
import { Separator } from '@renderer/components/ui/separator'
import { useAnime, type AnimeEpisodeEntry } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { getOpenVideoDialogOptions } from '@renderer/utils/dialog'
import { animeEpisodeFiles, animeEpisodes, type AnimeEpisodeFile } from '@shared/db'
import AnimeWatchButton from '../../../anime-watch-button.vue'
import AnimeEpisodeFormDialog from './episode-form-dialog.vue'
import AnimeFileRecordList from './file-record-list.vue'

const log = createLogger('Anime')

interface Props {
  animeId: string
  episodeId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m, f } = useI18n()
const { episodes } = useAnime()

const episode = computed<AnimeEpisodeEntry | null>(
  () => episodes.value.find((entry) => entry.id === props.episodeId) ?? null
)

const editDialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const isAttachingFile = ref(false)

const title = computed(() => {
  const entry = episode.value
  if (!entry) return ''
  const numbered =
    entry.episodeNumber === null
      ? null
      : m.value.anime.episodes.unnamed({ number: formatNumber(entry.episodeNumber) })
  return entry.name ?? numbered ?? m.value.common.emptyValue
})

const stillUrl = computed(() => {
  const entry = episode.value
  if (!entry?.stillFile) return null
  return getAttachmentUrl('anime_episodes', entry.id, entry.stillFile, { width: 640 })
})

const isWatched = computed(() => episode.value?.watchedAt !== null)

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

async function handleToggleWatched(): Promise<void> {
  const entry = episode.value
  if (!entry) return
  try {
    await db
      .update(animeEpisodes)
      .set(
        entry.watchedAt === null
          ? { watchedAt: new Date(), resumePositionMs: null }
          : { watchedAt: null }
      )
      .where(eq(animeEpisodes.id, entry.id))
    notify.success(m.value.anime.episodes.watchedUpdated)
  } catch {
    notify.error(m.value.library.feedback.updateFailed)
  }
}

async function handleDeleteEpisode(): Promise<void> {
  const entry = episode.value
  if (!entry) return
  try {
    await db.delete(animeEpisodes).where(eq(animeEpisodes.id, entry.id))
    notify.success(m.value.anime.episodes.episodeDeleted)
    open.value = false
  } catch (error) {
    log.error('Episode delete failed:', error)
    notify.error(m.value.common.deleteFailed)
  }
}

async function handleAttachFile(): Promise<void> {
  const entry = episode.value
  if (!entry || isAttachingFile.value) return

  isAttachingFile.value = true
  try {
    const dialogResult = await ipcManager.invoke('native:open-dialog', getOpenVideoDialogOptions())
    if (!dialogResult.success) {
      notify.error(dialogResult.error || m.value.library.feedback.pickFileFailed)
      return
    }
    const filePath = dialogResult.data?.filePaths[0]
    if (!filePath || dialogResult.data?.canceled) return

    const result = await ipcManager.invoke('ingest:attach-anime-episode-file', {
      episodeId: entry.id,
      path: filePath
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

async function handleSetPrimary(file: Pick<AnimeEpisodeFile, 'id' | 'isPrimary'>): Promise<void> {
  const entry = episode.value
  if (!entry || file.isPrimary) return
  try {
    await db
      .update(animeEpisodeFiles)
      .set({ isPrimary: false })
      .where(eq(animeEpisodeFiles.episodeId, entry.id))
    await db
      .update(animeEpisodeFiles)
      .set({ isPrimary: true })
      .where(eq(animeEpisodeFiles.id, file.id))
    notify.success(m.value.anime.files.primaryUpdated)
  } catch (error) {
    log.error('Set primary file failed:', error)
    notify.error(m.value.library.feedback.updateFailed)
  }
}

async function handleRemoveFile(fileId: string): Promise<void> {
  const entry = episode.value
  if (!entry) return
  try {
    const removed = entry.files.find((file) => file.id === fileId)
    await db.delete(animeEpisodeFiles).where(eq(animeEpisodeFiles.id, fileId))

    // Keep exactly one primary among the survivors.
    if (removed?.isPrimary) {
      const survivor = entry.files.find((file) => file.id !== fileId)
      if (survivor) {
        await db
          .update(animeEpisodeFiles)
          .set({ isPrimary: true })
          .where(eq(animeEpisodeFiles.id, survivor.id))
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
    await db.update(animeEpisodeFiles).set({ note }).where(eq(animeEpisodeFiles.id, fileId))
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

/** Plays one specific version file without touching the primary election. */
async function handlePlayFile(fileId: string): Promise<void> {
  const entry = episode.value
  if (!entry) return
  const result = await ipcManager.invoke('activity:watch-anime', props.animeId, entry.id, fileId)
  if (!result.success) {
    notify.error(m.value.activity.watchFailedTitle, result.error)
    return
  }
  if (result.data.status === 'failed') {
    notify.error(m.value.activity.watchFailedTitle, m.value.activity.errors[result.data.reason])
  }
}

</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl max-h-[85vh] flex flex-col">
      <template v-if="episode">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2 min-w-0">
            <span
              v-if="episode.episodeNumber !== null"
              class="font-mono text-muted-foreground shrink-0"
            >
              {{ formatNumber(episode.episodeNumber) }}
            </span>
            <span class="truncate">{{ title }}</span>
            <Badge
              v-if="episode.type !== 'regular'"
              variant="secondary"
              class="shrink-0"
            >
              {{ m.library.animeEpisodeType[episode.type] }}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <DialogBody class="flex-1 min-h-0 overflow-auto space-y-4">
          <!-- Still (display only; edited through the episode form) -->
          <div
            v-if="stillUrl"
            class="rounded-lg border bg-muted overflow-hidden"
          >
            <img
              :src="stillUrl"
              :alt="title"
              class="w-full max-h-64 object-contain"
            />
          </div>

          <!-- Facts -->
          <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="grid grid-cols-[auto_1fr] gap-3">
              <dt class="text-muted-foreground">{{ m.anime.episodes.airDate }}</dt>
              <dd>{{ episode.airDate ? f.date(episode.airDate) : m.common.emptyValue }}</dd>
            </div>
            <div class="grid grid-cols-[auto_1fr] gap-3">
              <dt class="text-muted-foreground">{{ m.library.fields.watchDuration }}</dt>
              <dd>{{ episode.durationMs ? f.duration(episode.durationMs) : m.common.emptyValue }}</dd>
            </div>
            <div class="grid grid-cols-[auto_1fr] gap-3">
              <dt class="text-muted-foreground">{{ m.anime.episodes.playCount }}</dt>
              <dd>{{ episode.playCount }}</dd>
            </div>
            <div class="grid grid-cols-[auto_1fr] gap-3">
              <dt class="text-muted-foreground">{{ m.anime.episodes.watchedAt }}</dt>
              <dd>
                {{ episode.watchedAt ? f.dateTime(episode.watchedAt) : m.anime.episodes.unwatched }}
              </dd>
            </div>
            <div
              v-if="episode.resumePositionMs"
              class="grid grid-cols-[auto_1fr] gap-3 col-span-2"
            >
              <dt class="text-muted-foreground">{{ m.anime.episodes.resumeLabel }}</dt>
              <dd>{{ f.durationFine(episode.resumePositionMs) }}</dd>
            </div>
          </dl>

          <!-- Description -->
          <div v-if="episode.description">
            <h4 class="text-xs font-medium text-muted-foreground mb-1.5">
              {{ m.library.detail.sections.description }}
            </h4>
            <p class="text-sm whitespace-pre-line">{{ episode.description }}</p>
          </div>

          <Separator />

          <!-- Files -->
          <AnimeFileRecordList
            :files="episode.files"
            :empty-text="m.anime.files.noFiles"
            :attaching="isAttachingFile"
            @attach="handleAttachFile"
            @play="handlePlayFile"
            @set-primary="handleSetPrimary"
            @remove-file="handleRemoveFile"
            @open-folder="handleOpenFolder"
            @save-note="handleSaveNote"
          />
        </DialogBody>

        <DialogFooter>
          <div class="flex items-center justify-between w-full">
            <AnimeWatchButton
              v-if="episode.files.length > 0"
              :anime-id="props.animeId"
              :episode-id="episode.id"
              size="sm"
            />
            <div v-else />

            <div class="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="icon-sm"
                :tooltip="
                  isWatched ? m.anime.episodes.markUnwatched : m.anime.episodes.markWatched
                "
                @click="handleToggleWatched"
              >
                <Icon
                  :icon="isWatched ? 'icon-[mdi--check-circle]' : 'icon-[mdi--circle-outline]'"
                  class="size-4"
                  :class="isWatched ? 'text-success' : ''"
                />
              </Button>

              <Button
                variant="secondary"
                size="icon-sm"
                :tooltip="m.anime.episodes.editEpisode"
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
                :tooltip="m.anime.episodes.deleteEpisode"
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

  <!-- Edit episode -->
  <AnimeEpisodeFormDialog
    v-if="editDialogOpen && episode"
    v-model:open="editDialogOpen"
    :anime-id="props.animeId"
    :episode="episode"
  />

  <!-- Delete episode confirmation -->
  <DeleteConfirmDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :entity-label="m.anime.episodes.entityLabel"
    :entity-name="title"
    @confirm="handleDeleteEpisode"
  />
</template>
