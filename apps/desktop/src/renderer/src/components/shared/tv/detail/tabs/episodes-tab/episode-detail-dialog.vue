<!--
  TvEpisodeDetailDialog
  Workbench for one episode: metadata, watch state, live playback controls,
  and the playable file records. Manual attachment creates user-owned rows;
  primary election and record removal act on sync-owned rows too (sync keeps
  a surviving primary preference, and removed in-library records reappear on
  the next sync pass). Staged field edits live in the episode form dialog
  opened from the footer. Disk files are never touched here.
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
import { Separator } from '@renderer/components/ui/separator'
import { useI18n } from '@renderer/composables/use-i18n'
import { useTv, type TvEpisodeEntry } from '@renderer/composables/use-tv'
import { revealTvFile, useTvFileRecords } from '@renderer/composables/use-tv-file-records'
import { toggleTvEpisodeWatched, useTvWatch } from '@renderer/composables/use-tv-watch'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { formatEpisodeNumber } from '@renderer/utils/format'
import { tvEpisodeFiles, tvEpisodes } from '@shared/db'
import TvWatchButton from '../../../tv-watch-button.vue'
import TvEpisodeFormDialog from './episode-form-dialog.vue'
import TvFileRecordList from './file-record-list.vue'
import { MediaPlaybackProgress } from '@renderer/components/shared/media'
import { formatTvSeasonLabel } from './season-label'

const log = createLogger('Tv')

interface Props {
  tvId: string
  episodeId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m, f } = useI18n()
const { episodes, seasons } = useTv()

const episode = computed<TvEpisodeEntry | null>(
  () => episodes.value.find((entry) => entry.id === props.episodeId) ?? null
)

const season = computed(() => seasons.value.find((entry) => entry.id === episode.value?.seasonId))

const editDialogOpen = ref(false)
const deleteDialogOpen = ref(false)

/** The SxxEyy code needs both numbers; either one alone stays out of the title. */
const episodeCode = computed(() => {
  const entry = episode.value
  const seasonNumber = season.value?.seasonNumber
  if (!entry || entry.episodeNumber === null || seasonNumber === undefined) return null
  return m.value.tv.episodes.code({
    season: seasonNumber,
    episode: String(entry.episodeNumber)
  })
})

const seasonLabel = computed(() =>
  season.value ? formatTvSeasonLabel(season.value, m.value) : null
)

const title = computed(() => {
  const entry = episode.value
  if (!entry) return ''
  const numbered =
    entry.episodeNumber === null
      ? null
      : m.value.tv.episodes.unnamed({ number: formatEpisodeNumber(entry.episodeNumber) })
  return entry.name ?? numbered ?? m.value.common.emptyValue
})

const stillUrl = computed(() => {
  const entry = episode.value
  if (!entry?.stillFile) return null
  return getAttachmentUrl('tv_episodes', entry.id, entry.stillFile, { width: 640 })
})

const isWatched = computed(() => episode.value?.watched === true)

// Marked episodes carry no playback time, so the fact row reads empty rather
// than unwatched for them.
const watchedAtText = computed(() => {
  const entry = episode.value
  if (!entry?.watched) return m.value.tv.episodes.unwatched
  return entry.watchedAt ? f.value.dateTime(entry.watchedAt) : m.value.common.emptyValue
})

async function handleToggleWatched(): Promise<void> {
  if (episode.value) await toggleTvEpisodeWatched(episode.value)
}

// =============================================================================
// Playback
// =============================================================================

const {
  isWatching,
  playbackStatus,
  playbackProgress,
  isPaused,
  isPauseActionPending,
  togglePause,
  watch: watchEpisode
} = useTvWatch(
  () => props.tvId,
  () => props.episodeId
)

// =============================================================================
// File records (immediate semantics; alternate versions of the same asset)
// =============================================================================

const { isAttaching, attachFile, setPrimary, removeFile, saveNote } = useTvFileRecords({
  owner: episode,
  table: tvEpisodeFiles,
  ownerColumn: tvEpisodeFiles.episodeId,
  attach: (episodeId, path) =>
    ipcManager.invoke('ingest:attach-tv-episode-file', { episodeId, path })
})

// =============================================================================
// Deletion (record only; sync re-creates in-library files it still owns)
// =============================================================================

async function handleDeleteEpisode(): Promise<void> {
  const entry = episode.value
  if (!entry) return
  try {
    await db.delete(tvEpisodes).where(eq(tvEpisodes.id, entry.id))
    notify.success(m.value.tv.episodes.episodeDeleted)
    open.value = false
  } catch (error) {
    log.error('Episode delete failed:', error)
    notify.error(m.value.common.deleteFailed)
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
              v-if="episodeCode"
              class="font-mono text-muted-foreground shrink-0"
            >
              {{ episodeCode }}
            </span>
            <span class="truncate">{{ title }}</span>
          </DialogTitle>
        </DialogHeader>

        <DialogBody class="flex-1 min-h-0 overflow-auto space-y-4">
          <!-- Live playback progress -->
          <MediaPlaybackProgress
            v-if="isWatching"
            :status="playbackStatus"
            :progress="playbackProgress"
          />

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
              <dt class="text-muted-foreground">{{ m.tv.episodes.seasonLabel }}</dt>
              <dd>{{ seasonLabel ?? m.common.emptyValue }}</dd>
            </div>
            <div class="grid grid-cols-[auto_1fr] gap-3">
              <dt class="text-muted-foreground">{{ m.tv.episodes.airDate }}</dt>
              <dd>{{ episode.airDate ? f.date(episode.airDate) : m.common.emptyValue }}</dd>
            </div>
            <div class="grid grid-cols-[auto_1fr] gap-3">
              <dt class="text-muted-foreground">{{ m.library.fields.watchDuration }}</dt>
              <dd>
                {{ episode.durationMs ? f.duration(episode.durationMs) : m.common.emptyValue }}
              </dd>
            </div>
            <div class="grid grid-cols-[auto_1fr] gap-3">
              <dt class="text-muted-foreground">{{ m.tv.episodes.playCount }}</dt>
              <dd>{{ episode.playCount }}</dd>
            </div>
            <div class="grid grid-cols-[auto_1fr] gap-3">
              <dt class="text-muted-foreground">{{ m.tv.episodes.watchedAt }}</dt>
              <dd>{{ watchedAtText }}</dd>
            </div>
            <div
              v-if="episode.resumePositionMs"
              class="grid grid-cols-[auto_1fr] gap-3"
            >
              <dt class="text-muted-foreground">{{ m.tv.episodes.resumeLabel }}</dt>
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
          <TvFileRecordList
            :files="episode.files"
            :empty-text="m.tv.files.noFiles"
            :attaching="isAttaching"
            @attach="attachFile"
            @play="watchEpisode"
            @set-primary="setPrimary"
            @remove-file="removeFile"
            @open-folder="revealTvFile"
            @save-note="saveNote"
          />
        </DialogBody>

        <DialogFooter>
          <div class="flex items-center justify-between w-full">
            <div class="flex items-center gap-1.5">
              <TvWatchButton
                v-if="episode.files.length > 0"
                :tv-id="props.tvId"
                :episode-id="episode.id"
                size="sm"
              />

              <Button
                v-if="isWatching"
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
                :tooltip="isWatched ? m.tv.episodes.markUnwatched : m.tv.episodes.markWatched"
                @click="handleToggleWatched"
              >
                <Icon
                  icon="icon-[mdi--circle]"
                  class="size-4"
                  :class="isWatched ? 'text-success' : ''"
                />
              </Button>

              <Button
                variant="secondary"
                size="icon-sm"
                :tooltip="m.tv.episodes.editEpisode"
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
                :tooltip="m.tv.episodes.deleteEpisode"
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
  <TvEpisodeFormDialog
    v-if="editDialogOpen && episode"
    v-model:open="editDialogOpen"
    :tv-id="props.tvId"
    :episode="episode"
  />

  <!-- Delete episode confirmation -->
  <DeleteConfirmDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :entity-label="m.tv.episodes.entityLabel"
    :entity-name="title"
    @confirm="handleDeleteEpisode"
  />
</template>
