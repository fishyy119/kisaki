<!--
  ComicFileRecordList
  File records of one comic unit: probe facts, primary election, note display
  and editing, manual attachment, and record removal. This list only reports
  intents; the parent owns the mutations. Disk files are never touched here.
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
import { Field, FieldContent, FieldGroup, FieldLabel } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { Icon } from '@renderer/components/ui/icon'
import { Input } from '@renderer/components/ui/input'
import { StateView } from '@renderer/components/ui/state-view'
import { useI18n } from '@renderer/composables/use-i18n'
import { formatBytes } from '@renderer/utils/format'
import type { ComicChapterFile } from '@shared/db'

interface Props {
  files: ComicChapterFile[]
  /** Disables the attach button while an attachment is running. */
  attaching?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  attach: []
  read: [fileId: string]
  setPrimary: [file: ComicChapterFile]
  removeFile: [fileId: string]
  openFolder: [path: string]
  saveNote: [fileId: string, note: string | null]
}>()

const { m } = useI18n()

const removeFileId = ref<string | null>(null)

const removeFileDialogOpen = computed({
  get: () => removeFileId.value !== null,
  set: (value) => {
    if (!value) removeFileId.value = null
  }
})

// Note editing owns only the input value; persistence is the parent's intent.
const noteTarget = ref<ComicChapterFile | null>(null)
const noteDraft = ref('')

const noteDialogOpen = computed({
  get: () => noteTarget.value !== null,
  set: (value) => {
    if (!value) noteTarget.value = null
  }
})

function openNoteEditor(file: ComicChapterFile): void {
  noteTarget.value = file
  noteDraft.value = file.note ?? ''
}

function handleNoteSubmit(): void {
  const target = noteTarget.value
  if (!target) return
  emit('saveNote', target.id, noteDraft.value.trim() || null)
  noteTarget.value = null
}

function fileBasename(filePath: string): string {
  const segments = filePath.split(/[\\/]/)
  return segments[segments.length - 1] || filePath
}

function fileFacts(file: ComicChapterFile): string {
  const parts: string[] = []
  if (file.container) parts.push(file.container)
  if (file.pageCount !== null && file.pageCount > 0) {
    parts.push(m.value.comic.chapters.pageCount({ count: file.pageCount }))
  }
  if (file.fileSize !== null && file.fileSize > 0) parts.push(formatBytes(file.fileSize))
  return parts.join(' · ')
}
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <h4 class="text-xs font-medium text-muted-foreground">
        {{ m.comic.files.title }}
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
        {{ m.comic.files.addFile }}
      </Button>
    </div>

    <StateView
      v-if="props.files.length === 0"
      state="empty"
      :description="m.comic.files.noFiles"
      class="py-3"
    />
    <div
      v-else
      class="space-y-2"
    >
      <div
        v-for="file in props.files"
        :key="file.id"
        class="flex items-center justify-between gap-3 rounded-lg border bg-muted/50 p-2.5"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <p class="truncate text-sm font-medium">{{ fileBasename(file.path) }}</p>
            <Badge
              v-if="file.isPrimary"
              variant="secondary"
              class="shrink-0"
            >
              {{ m.comic.files.primary }}
            </Badge>
            <Badge
              v-if="file.isManual"
              variant="outline"
              class="shrink-0"
            >
              {{ m.comic.files.manualBadge }}
            </Badge>
          </div>
          <p class="truncate text-xs text-muted-foreground">{{ fileFacts(file) }}</p>
          <p
            v-if="file.note"
            class="truncate text-xs italic text-muted-foreground"
          >
            {{ file.note }}
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            :tooltip="m.comic.files.readFile"
            @click="emit('read', file.id)"
          >
            <Icon
              icon="icon-[mdi--book-open-page-variant-outline]"
              class="size-4"
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :tooltip="m.comic.files.openFolder"
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
                {{ m.comic.files.setPrimary }}
              </DropdownMenuItem>
              <DropdownMenuItem @click="openNoteEditor(file)">
                <Icon
                  icon="icon-[mdi--note-edit-outline]"
                  class="size-4"
                />
                {{ m.comic.files.editNote }}
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
                {{ m.comic.files.removeFile }}
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
          <DialogTitle>{{ m.comic.files.editNote }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleNoteSubmit">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.comic.files.noteLabel }}</FieldLabel>
                <FieldContent>
                  <Input v-model="noteDraft" />
                </FieldContent>
              </Field>
            </FieldGroup>
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

    <!-- Remove file record confirmation -->
    <DeleteConfirmDialog
      v-if="removeFileDialogOpen"
      v-model:open="removeFileDialogOpen"
      :entity-label="m.comic.files.recordEntityLabel"
      mode="remove"
      @confirm="removeFileId !== null && emit('removeFile', removeFileId)"
    />
  </div>
</template>
