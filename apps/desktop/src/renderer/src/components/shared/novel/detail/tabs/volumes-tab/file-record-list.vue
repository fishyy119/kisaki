<!--
  NovelFileRecordList
  File records of one novel volume: container facts, primary election, note
  display and editing, manual attachment, and record removal. This list only
  reports intents; the parent owns the mutations. Disk files are never touched.
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
import type { NovelVolumeFile } from '@shared/db'

interface Props {
  files: NovelVolumeFile[]
  /** Disables the attach button while an attachment is running. */
  attaching?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  attach: []
  read: [fileId: string]
  setPrimary: [file: NovelVolumeFile]
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
const noteTarget = ref<NovelVolumeFile | null>(null)
const noteDraft = ref('')

const noteDialogOpen = computed({
  get: () => noteTarget.value !== null,
  set: (value) => {
    if (!value) noteTarget.value = null
  }
})

function openNoteEditor(file: NovelVolumeFile): void {
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

function fileFacts(file: NovelVolumeFile): string[] {
  const parts: string[] = []
  if (file.container) parts.push(file.container)
  if (file.fileSize !== null && file.fileSize > 0) parts.push(formatBytes(file.fileSize))
  return parts
}
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <h4 class="text-xs font-medium text-muted-foreground">
        {{ m.novel.files.title }}
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
        {{ m.novel.files.addFile }}
      </Button>
    </div>

    <StateView
      v-if="props.files.length === 0"
      state="empty"
      :description="m.novel.files.noFiles"
      class="py-3"
    />
    <div
      v-else
      class="rounded-md border divide-y overflow-hidden"
    >
      <div
        v-for="file in props.files"
        :key="file.id"
        class="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-accent/30"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <p class="truncate text-sm font-medium">{{ fileBasename(file.path) }}</p>
            <Badge
              v-if="file.isPrimary"
              variant="secondary"
              class="shrink-0"
            >
              {{ m.novel.files.primary }}
            </Badge>
            <Badge
              v-if="file.isManual"
              variant="outline"
              class="shrink-0"
            >
              {{ m.novel.files.manualBadge }}
            </Badge>
          </div>
          <div class="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            <span
              v-for="fact in fileFacts(file)"
              :key="fact"
            >
              {{ fact }}
            </span>
          </div>
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
            :tooltip="m.novel.files.readFile"
            @click="emit('read', file.id)"
          >
            <Icon
              icon="icon-[mdi--play]"
              class="size-4"
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :tooltip="m.novel.files.openFolder"
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
                {{ m.novel.files.setPrimary }}
              </DropdownMenuItem>
              <DropdownMenuItem @click="openNoteEditor(file)">
                <Icon
                  icon="icon-[mdi--note-edit-outline]"
                  class="size-4"
                />
                {{ m.novel.files.editNote }}
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
                {{ m.novel.files.removeFile }}
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
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{{ m.novel.files.editNote }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleNoteSubmit">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.novel.files.noteLabel }}</FieldLabel>
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
              {{ m.actions.cancel }}
            </Button>
            <Button type="submit">{{ m.actions.save }}</Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>

    <!-- Remove file record confirmation -->
    <DeleteConfirmDialog
      v-if="removeFileDialogOpen"
      v-model:open="removeFileDialogOpen"
      :entity-label="m.novel.files.recordEntityLabel"
      mode="remove"
      @confirm="removeFileId !== null && emit('removeFile', removeFileId)"
    />
  </div>
</template>
