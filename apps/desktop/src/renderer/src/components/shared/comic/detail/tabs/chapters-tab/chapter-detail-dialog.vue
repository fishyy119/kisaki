<!--
  ComicChapterDetailDialog
  Workbench for one comic unit: identity, read state, and the readable file
  records. Manual attachment creates user-owned rows; primary election and
  record removal act on sync-owned rows too (sync keeps a surviving primary
  preference, and removed in-library records reappear on the next sync pass).
  Staged field edits live in the unit form dialog opened from the footer.
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
import { useComic, type ComicChapterEntry } from '@renderer/composables/use-comic'
import { revealComicFile, useComicFileRecords } from '@renderer/composables/use-comic-file-records'
import { toggleChapterRead } from '@renderer/composables/comic-completion'
import { useComicReading } from '@renderer/composables/use-comic-reading'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { formatUnitNumber } from '@renderer/utils/format'
import { comicChapters } from '@shared/db'
import ComicReadButton from '../../../comic-read-button.vue'
import ComicChapterFormDialog from './chapter-form-dialog.vue'
import ComicFileRecordList from './file-record-list.vue'

const log = createLogger('Library')

interface Props {
  comicId: string
  chapterId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m, f } = useI18n()
const { chapters } = useComic()
const { read } = useComicReading(
  () => props.comicId,
  () => props.chapterId
)

const chapter = computed<ComicChapterEntry | null>(
  () => chapters.value.find((entry) => entry.id === props.chapterId) ?? null
)

const editDialogOpen = ref(false)
const deleteDialogOpen = ref(false)

const title = computed(() => {
  const entry = chapter.value
  if (!entry) return ''
  if (entry.name) return entry.name
  if (entry.chapterNumber !== null) {
    return m.value.comic.chapters.unnamedChapter({
      number: formatUnitNumber(entry.chapterNumber)
    })
  }
  if (entry.volumeNumber !== null) {
    return m.value.comic.chapters.unnamedVolume({ number: formatUnitNumber(entry.volumeNumber) })
  }
  return m.value.values.emptyValue
})

const coverUrl = computed(() => {
  const entry = chapter.value
  if (!entry?.coverFile) return null
  return getAttachmentUrl('comic_chapters', entry.id, entry.coverFile, { width: 320 })
})

const isRead = computed(() => chapter.value?.read === true)

// Marked units carry no reading time, so the fact row reads empty rather than
// unread for them.
const readAtText = computed(() => {
  const entry = chapter.value
  if (!entry?.read) return m.value.comic.chapters.unread
  return entry.readAt ? f.value.dateTime(entry.readAt) : m.value.values.emptyValue
})

const { isAttaching, attachFile, setPrimary, removeFile, saveNote } = useComicFileRecords(chapter)

async function handleToggleRead(): Promise<void> {
  if (chapter.value) await toggleChapterRead(chapter.value)
}

async function handleDeleteChapter(): Promise<void> {
  const entry = chapter.value
  if (!entry) return
  try {
    await db.delete(comicChapters).where(eq(comicChapters.id, entry.id))
    notify.success(m.value.comic.chapters.chapterDeleted)
    open.value = false
  } catch (error) {
    log.error('Comic unit delete failed:', error)
    notify.error(m.value.feedback.deleteFailed)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[85vh] max-w-2xl flex-col">
      <template v-if="chapter">
        <DialogHeader>
          <DialogTitle class="flex min-w-0 items-center gap-2">
            <span
              v-if="chapter.volumeNumber !== null"
              class="shrink-0 font-mono text-muted-foreground"
            >
              {{
                m.comic.chapters.unnamedVolume({ number: formatUnitNumber(chapter.volumeNumber) })
              }}
            </span>
            <span
              v-if="chapter.chapterNumber !== null"
              class="shrink-0 font-mono text-muted-foreground"
            >
              {{ formatUnitNumber(chapter.chapterNumber) }}
            </span>
            <span class="truncate">{{ title }}</span>
          </DialogTitle>
        </DialogHeader>

        <DialogBody class="min-h-0 flex-1 space-y-4">
          <!-- Cover (display only; edited through the chapter form) -->
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
              <dt class="text-muted-foreground">{{ m.comic.chapters.releaseDate }}</dt>
              <dd>
                {{ chapter.releaseDate ? f.date(chapter.releaseDate) : m.values.emptyValue }}
              </dd>
            </div>
            <div class="grid grid-cols-[auto_1fr] gap-3">
              <dt class="text-muted-foreground">{{ m.comic.chapters.readCount }}</dt>
              <dd>{{ chapter.readCount }}</dd>
            </div>
            <div class="grid grid-cols-[auto_1fr] gap-3">
              <dt class="text-muted-foreground">{{ m.comic.chapters.readAt }}</dt>
              <dd>{{ readAtText }}</dd>
            </div>
            <div
              v-if="chapter.resumePage"
              class="grid grid-cols-[auto_1fr] gap-3"
            >
              <dt class="text-muted-foreground">{{ m.comic.chapters.read }}</dt>
              <dd>{{ m.comic.chapters.resumeAt({ page: chapter.resumePage }) }}</dd>
            </div>
          </dl>

          <!-- Description -->
          <div v-if="chapter.description">
            <h4 class="mb-1.5 text-xs font-medium text-muted-foreground">
              {{ m.library.detail.sections.description }}
            </h4>
            <p class="whitespace-pre-line text-sm">{{ chapter.description }}</p>
          </div>

          <Separator />

          <!-- Files -->
          <ComicFileRecordList
            :files="chapter.files"
            :attaching="isAttaching"
            @attach="attachFile"
            @read="(fileId) => read(fileId)"
            @set-primary="setPrimary"
            @remove-file="removeFile"
            @open-folder="revealComicFile"
            @save-note="saveNote"
          />
        </DialogBody>

        <DialogFooter>
          <div class="flex w-full items-center justify-between">
            <ComicReadButton
              v-if="chapter.files.length > 0"
              :comic-id="props.comicId"
              :chapter-id="chapter.id"
              size="sm"
            />
            <span v-else />

            <div class="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="icon-sm"
                :tooltip="isRead ? m.comic.chapters.markUnread : m.comic.chapters.markRead"
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
                :tooltip="m.comic.chapters.editChapter"
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
                :tooltip="m.comic.chapters.deleteChapter"
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

  <!-- Edit unit -->
  <ComicChapterFormDialog
    v-if="editDialogOpen && chapter"
    v-model:open="editDialogOpen"
    :comic-id="props.comicId"
    :chapter-id="chapter.id"
  />

  <!-- Delete unit confirmation -->
  <DeleteConfirmDialog
    v-if="deleteDialogOpen"
    v-model:open="deleteDialogOpen"
    :entity-label="m.comic.chapters.entityLabel"
    :entity-name="title"
    @confirm="handleDeleteChapter"
  />
</template>
