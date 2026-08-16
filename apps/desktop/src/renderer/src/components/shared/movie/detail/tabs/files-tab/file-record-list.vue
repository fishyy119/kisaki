<!--
  MovieFileRecordList
  File records of the feature or one extra: probe facts, primary election, note
  and edition editing, manual attachment, and record removal. The parent owns
  which table a mutation targets; this list only reports intents. Disk files are
  never touched here.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge } from '@renderer/components/ui/badge'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Field, FieldContent, FieldLabel } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { Icon } from '@renderer/components/ui/icon'
import { Input } from '@renderer/components/ui/input'
import { useI18n } from '@renderer/composables/use-i18n'
import { formatBytes } from '@renderer/utils/format'
import type { MovieExtraFile, MovieFile } from '@shared/db'

type FileRecord = MovieFile | MovieExtraFile

interface Props {
  files: FileRecord[]
  /** Shown when there are no file records. */
  emptyText: string
  /**
   * Rows are releases of the feature, so they carry an edition label. Extra
   * files have no editions, so the badge and its editor stay hidden for them.
   */
  editions?: boolean
  /** Disables the attach button while an attachment is running. */
  attaching?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  attach: []
  play: [fileId: string]
  setPrimary: [file: FileRecord]
  removeFile: [fileId: string]
  openFolder: [path: string]
  saveNote: [fileId: string, note: string | null]
  saveEdition: [fileId: string, edition: string | null]
}>()

const { m } = useI18n()

const removeFileId = ref<string | null>(null)

const removeFileDialogOpen = computed({
  get: () => removeFileId.value !== null,
  set: (value) => {
    if (!value) removeFileId.value = null
  }
})

// Note and edition editing own only their input value; persistence is the
// parent's intent.
const noteTarget = ref<FileRecord | null>(null)
const noteDraft = ref('')

const noteDialogOpen = computed({
  get: () => noteTarget.value !== null,
  set: (value) => {
    if (!value) noteTarget.value = null
  }
})

const editionTarget = ref<FileRecord | null>(null)
const editionDraft = ref('')

const editionDialogOpen = computed({
  get: () => editionTarget.value !== null,
  set: (value) => {
    if (!value) editionTarget.value = null
  }
})

function openNoteEditor(file: FileRecord): void {
  noteTarget.value = file
  noteDraft.value = file.note ?? ''
}

function handleNoteSubmit(): void {
  const target = noteTarget.value
  if (!target) return
  emit('saveNote', target.id, noteDraft.value.trim() || null)
  noteTarget.value = null
}

function fileEdition(file: FileRecord): string | null {
  return 'edition' in file ? file.edition : null
}

function openEditionEditor(file: FileRecord): void {
  editionTarget.value = file
  editionDraft.value = fileEdition(file) ?? ''
}

function handleEditionSubmit(): void {
  const target = editionTarget.value
  if (!target) return
  emit('saveEdition', target.id, editionDraft.value.trim() || null)
  editionTarget.value = null
}

function fileBasename(filePath: string): string {
  const segments = filePath.split(/[\\/]/)
  return segments[segments.length - 1] || filePath
}

function fileFacts(file: FileRecord): string {
  const parts: string[] = []
  if (file.width && file.height) parts.push(`${file.width}×${file.height}`)
  if (file.videoCodec) parts.push(file.videoCodec)
  if (file.fileSize !== null && file.fileSize > 0) parts.push(formatBytes(file.fileSize))
  if (file.audioTracks.length > 0) {
    parts.push(m.value.movie.files.audioTrackCount({ count: file.audioTracks.length }))
  }
  if (file.subtitleTracks.length > 0) {
    parts.push(m.value.movie.files.subtitleTrackCount({ count: file.subtitleTracks.length }))
  }
  return parts.join(' · ')
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-2">
      <h4 class="text-xs font-medium text-muted-foreground">
        {{ m.movie.files.title }}
      </h4>
      <Button
        variant="outline"
        size="xs"
        :disabled="props.attaching"
        @click="emit('attach')"
      >
        <Icon
          :icon="props.attaching ? 'icon-[mdi--loading]' : 'icon-[mdi--plus]'"
          :class="props.attaching ? 'size-3.5 animate-spin' : 'size-3.5'"
        />
        {{ m.movie.files.addFile }}
      </Button>
    </div>

    <p
      v-if="props.files.length === 0"
      class="text-sm text-muted-foreground py-3 text-center"
    >
      {{ props.emptyText }}
    </p>
    <div
      v-else
      class="space-y-2"
    >
      <div
        v-for="file in props.files"
        :key="file.id"
        class="flex items-center justify-between gap-3 p-2.5 rounded-lg border bg-muted/50"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-sm font-medium truncate">{{ fileBasename(file.path) }}</p>
            <Badge
              v-if="props.editions && fileEdition(file)"
              variant="outline"
              class="shrink-0"
            >
              {{ fileEdition(file) }}
            </Badge>
            <Badge
              v-if="file.isPrimary"
              variant="secondary"
              class="shrink-0"
            >
              {{ m.movie.files.primary }}
            </Badge>
            <Badge
              v-if="file.isManual"
              variant="outline"
              class="shrink-0"
            >
              {{ m.movie.files.manualBadge }}
            </Badge>
          </div>
          <p class="text-xs text-muted-foreground truncate">{{ fileFacts(file) }}</p>
          <p
            v-if="file.note"
            class="text-xs text-muted-foreground truncate italic"
          >
            {{ file.note }}
          </p>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            :tooltip="m.movie.files.playFile"
            @click="emit('play', file.id)"
          >
            <Icon
              icon="icon-[mdi--play]"
              class="size-4"
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :tooltip="m.movie.files.openFolder"
            @click="emit('openFolder', file.path)"
          >
            <Icon
              icon="icon-[mdi--folder-open-outline]"
              class="size-4"
            />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
              >
                <Icon
                  icon="icon-[mdi--dots-horizontal]"
                  class="size-4"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                v-if="!file.isPrimary"
                @click="emit('setPrimary', file)"
              >
                <Icon
                  icon="icon-[mdi--star-outline]"
                  class="size-4"
                />
                {{ m.movie.files.setPrimary }}
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="props.editions"
                @click="openEditionEditor(file)"
              >
                <Icon
                  icon="icon-[mdi--tag-outline]"
                  class="size-4"
                />
                {{ m.movie.files.editionLabel }}
              </DropdownMenuItem>
              <DropdownMenuItem @click="openNoteEditor(file)">
                <Icon
                  icon="icon-[mdi--note-edit-outline]"
                  class="size-4"
                />
                {{ m.movie.files.editNote }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                @click="removeFileId = file.id"
              >
                <Icon
                  icon="icon-[mdi--delete-outline]"
                  class="size-4"
                />
                {{ m.movie.files.removeFile }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>

    <!-- Note editor -->
    <Dialog
      v-if="noteTarget"
      v-model:open="noteDialogOpen"
    >
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ m.movie.files.editNote }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleNoteSubmit">
          <DialogBody>
            <Field>
              <FieldLabel>{{ m.movie.files.noteLabel }}</FieldLabel>
              <FieldContent>
                <Input v-model="noteDraft" />
              </FieldContent>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              @click="noteDialogOpen = false"
            >
              {{ m.common.cancel }}
            </Button>
            <Button type="submit">{{ m.common.save }}</Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>

    <!-- Edition editor -->
    <Dialog
      v-if="editionTarget"
      v-model:open="editionDialogOpen"
    >
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ m.movie.files.editionLabel }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleEditionSubmit">
          <DialogBody>
            <Field>
              <FieldLabel>{{ m.movie.files.editionLabel }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="editionDraft"
                  :placeholder="m.movie.files.editionPlaceholder"
                />
              </FieldContent>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              @click="editionDialogOpen = false"
            >
              {{ m.common.cancel }}
            </Button>
            <Button type="submit">{{ m.common.save }}</Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>

    <!-- Remove file record confirmation -->
    <DeleteConfirmDialog
      v-if="removeFileDialogOpen"
      v-model:open="removeFileDialogOpen"
      :entity-label="m.movie.files.recordEntityLabel"
      mode="remove"
      @confirm="removeFileId !== null && emit('removeFile', removeFileId)"
    />
  </div>
</template>
