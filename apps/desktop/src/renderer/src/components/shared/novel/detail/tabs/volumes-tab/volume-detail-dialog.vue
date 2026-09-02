<!--
  NovelVolumeDetailDialog
  Workbench for one novel volume: identity, read state, and the readable file
  records. Manual attachment creates user-owned rows; primary election and
  record removal act on sync-owned rows too (sync keeps a surviving primary
  preference, and removed in-library records reappear on the next sync pass).
  Staged field edits live in the volume form dialog opened from the footer.
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
import { useNovel, type NovelVolumeEntry } from '@renderer/composables/use-novel'
import { revealNovelFile, useNovelFileRecords } from '@renderer/composables/use-novel-file-records'
import { toggleVolumeRead } from '@renderer/composables/novel-completion'
import { useNovelReading } from '@renderer/composables/use-novel-reading'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { formatUnitNumber } from '@renderer/utils/format'
import { novelVolumes } from '@shared/db'
import NovelReadButton from '../../../novel-read-button.vue'
import NovelFileRecordList from './file-record-list.vue'
import NovelVolumeFormDialog from './volume-form-dialog.vue'

const log = createLogger('Library')

interface Props {
  novelId: string
  volumeId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m, f } = useI18n()
const { volumes } = useNovel()
const { read } = useNovelReading(
  () => props.novelId,
  () => props.volumeId
)

const volume = computed<NovelVolumeEntry | null>(
  () => volumes.value.find((entry) => entry.id === props.volumeId) ?? null
)

const editDialogOpen = ref(false)
const deleteDialogOpen = ref(false)

const title = computed(() => {
  const entry = volume.value
  if (!entry) return ''
  if (entry.name) return entry.name
  if (entry.volumeNumber !== null) {
    return m.value.novel.volumes.unnamed({ number: formatUnitNumber(entry.volumeNumber) })
  }
  return m.value.values.emptyValue
})

const coverUrl = computed(() => {
  const entry = volume.value
  if (!entry?.coverFile) return null
  return getAttachmentUrl('novel_volumes', entry.id, entry.coverFile, { width: 320 })
})

const isRead = computed(() => volume.value?.read === true)

// Marked volumes carry no reading time, so the fact row reads empty rather
// than unread for them.
const readAtText = computed(() => {
  const entry = volume.value
  if (!entry?.read) return m.value.novel.volumes.unread
  return entry.readAt ? f.value.dateTime(entry.readAt) : m.value.values.emptyValue
})

const resumePercent = computed(() =>
  volume.value?.resumeProgress != null ? Math.round(volume.value.resumeProgress * 100) : null
)

const { isAttaching, attachFile, setPrimary, removeFile, saveNote } = useNovelFileRecords(volume)

async function handleToggleRead(): Promise<void> {
  if (volume.value) await toggleVolumeRead(volume.value)
}

async function handleDeleteVolume(): Promise<void> {
  const entry = volume.value
  if (!entry) return
  try {
    await db.delete(novelVolumes).where(eq(novelVolumes.id, entry.id))
    notify.success(m.value.novel.volumes.volumeDeleted)
    open.value = false
  } catch (error) {
    log.error('Novel volume delete failed:', error)
    notify.error(m.value.feedback.deleteFailed)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[85vh] max-w-2xl flex-col">
      <template v-if="volume">
        <DialogHeader>
          <DialogTitle class="flex min-w-0 items-center gap-2">
            <span
              v-if="volume.volumeNumber !== null"
              class="shrink-0 font-mono text-muted-foreground"
            >
              {{ formatUnitNumber(volume.volumeNumber) }}
            </span>
            <span class="truncate">{{ title }}</span>
          </DialogTitle>
        </DialogHeader>

        <DialogBody class="min-h-0 flex-1 space-y-4 overflow-auto">
          <!-- Cover (display only; edited through the volume form) -->
          <div
            v-if="coverUrl"
            class="overflow-hidden rounded-lg border bg-muted"
          >
            <img
              :src="coverUrl"
              :alt="title"
              class="mx-auto max-h-64 object-contain"
            />
          </div>

          <!-- Facts -->
          <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div class="grid grid-cols-[auto_1fr] gap-3">
              <dt class="text-muted-foreground">{{ m.novel.volumes.releaseDate }}</dt>
              <dd>{{ volume.releaseDate ? f.date(volume.releaseDate) : m.values.emptyValue }}</dd>
            </div>
            <div class="grid grid-cols-[auto_1fr] gap-3">
              <dt class="text-muted-foreground">{{ m.novel.volumes.readCount }}</dt>
              <dd>{{ volume.readCount }}</dd>
            </div>
            <div class="grid grid-cols-[auto_1fr] gap-3">
              <dt class="text-muted-foreground">{{ m.novel.volumes.readAt }}</dt>
              <dd>{{ readAtText }}</dd>
            </div>
            <div
              v-if="resumePercent !== null"
              class="grid grid-cols-[auto_1fr] gap-3"
            >
              <dt class="text-muted-foreground">{{ m.novel.volumes.read }}</dt>
              <dd>{{ m.novel.volumes.resumeProgress({ percent: resumePercent }) }}</dd>
            </div>
          </dl>

          <!-- Description -->
          <div v-if="volume.description">
            <h4 class="mb-1.5 text-xs font-medium text-muted-foreground">
              {{ m.library.detail.sections.description }}
            </h4>
            <p class="whitespace-pre-line text-sm">{{ volume.description }}</p>
          </div>

          <Separator />

          <!-- Files -->
          <NovelFileRecordList
            :files="volume.files"
            :attaching="isAttaching"
            @attach="attachFile"
            @read="(fileId) => read(fileId)"
            @set-primary="setPrimary"
            @remove-file="removeFile"
            @open-folder="revealNovelFile"
            @save-note="saveNote"
          />
        </DialogBody>

        <DialogFooter>
          <div class="flex w-full items-center justify-between">
            <NovelReadButton
              v-if="volume.files.length > 0"
              :novel-id="props.novelId"
              :volume-id="volume.id"
              size="sm"
            />
            <span v-else />

            <div class="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="icon-sm"
                :tooltip="isRead ? m.novel.volumes.markUnread : m.novel.volumes.markRead"
                @click="handleToggleRead"
              >
                <Icon
                  :icon="isRead ? 'icon-[mdi--circle]' : 'icon-[mdi--circle-outline]'"
                  class="size-4"
                  :class="isRead ? 'text-success' : ''"
                />
              </Button>

              <Button
                variant="secondary"
                size="icon-sm"
                :tooltip="m.novel.volumes.editVolume"
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
                :tooltip="m.novel.volumes.deleteVolume"
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

  <!-- Edit volume -->
  <NovelVolumeFormDialog
    v-if="editDialogOpen && volume"
    v-model:open="editDialogOpen"
    :novel-id="props.novelId"
    :volume-id="volume.id"
  />

  <!-- Delete volume confirmation -->
  <DeleteConfirmDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :entity-label="m.novel.volumes.entityLabel"
    :entity-name="title"
    @confirm="handleDeleteVolume"
  />
</template>
