<!--
  AnimeExtraFormDialog
  Creates or edits an extra. Creation picks an on-disk video and may leave
  name/type to filename recognition; editing offers file management (alternate
  versions attach to the same extra) and deletion. Rows touched here are
  user-owned, so file sync stops rewriting them.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import { Field, FieldContent, FieldLabel } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { Icon } from '@renderer/components/ui/icon'
import { Input } from '@renderer/components/ui/input'
import { Separator } from '@renderer/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useI18n } from '@renderer/composables/use-i18n'
import type { AnimeExtraEntry } from '@renderer/composables/use-anime'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { getOpenVideoDialogOptions } from '@renderer/utils/dialog'
import { animeExtraFiles, animeExtras, type AnimeExtraFile, type AnimeExtraType } from '@shared/db'
import AnimeFileRecordList from './file-record-list.vue'

const log = createLogger('Anime')

interface Props {
  animeId: string
  /** Row to edit; omit to create a new extra from a picked file. */
  extra?: AnimeExtraEntry
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const isEditing = computed(() => props.extra !== undefined)

/** `auto` defers name and type to filename recognition at attach time. */
type TypeChoice = AnimeExtraType | 'auto'

const TYPE_VALUES = ['trailer', 'pv', 'ncop', 'nced', 'interview', 'other'] as const

const typeOptions = computed<{ value: TypeChoice; label: string }[]>(() => [
  ...(isEditing.value
    ? []
    : [{ value: 'auto' as const, label: m.value.anime.extras.autoDetect }]),
  ...TYPE_VALUES.map((value) => ({ value, label: m.value.library.animeExtraType[value] }))
])

const filePath = ref('')
const name = ref('')
const type = ref<TypeChoice>('auto')
const isSaving = ref(false)
const isAttachingFile = ref(false)

watch(
  () => props.extra,
  (extra) => {
    name.value = extra?.name ?? ''
    type.value = extra?.type ?? 'auto'
  },
  { immediate: true }
)

const canSave = computed(() => {
  if (isSaving.value) return false
  if (!isEditing.value) return filePath.value.length > 0
  return name.value.trim().length > 0
})

async function pickVideoFile(): Promise<string | null> {
  const dialogResult = await ipcManager.invoke('native:open-dialog', getOpenVideoDialogOptions())
  if (!dialogResult.success) {
    notify.error(dialogResult.error || m.value.library.feedback.pickFileFailed)
    return null
  }
  const picked = dialogResult.data?.filePaths[0]
  if (!picked || dialogResult.data?.canceled) return null
  return picked
}

async function handlePickFile(): Promise<void> {
  const picked = await pickVideoFile()
  if (picked) filePath.value = picked
}

async function handleSubmit(): Promise<void> {
  if (!canSave.value) return
  isSaving.value = true
  try {
    if (isEditing.value) {
      await saveEdit()
    } else {
      await saveCreate()
    }
  } finally {
    isSaving.value = false
  }
}

async function saveCreate(): Promise<void> {
  const result = await ipcManager.invoke('ingest:attach-anime-extra-file', {
    animeId: props.animeId,
    path: filePath.value,
    ...(name.value.trim() ? { name: name.value.trim() } : {}),
    ...(type.value === 'auto' ? {} : { type: type.value })
  })
  if (!result.success) {
    notify.error(m.value.anime.files.attachFailed, result.error)
    return
  }

  notify.success(m.value.anime.extras.extraAttached)
  open.value = false
}

async function saveEdit(): Promise<void> {
  const extra = props.extra
  if (!extra || type.value === 'auto') return

  try {
    await db
      .update(animeExtras)
      .set({ name: name.value.trim(), type: type.value, isManual: true })
      .where(eq(animeExtras.id, extra.id))
    notify.success(m.value.anime.extras.extraUpdated)
    open.value = false
  } catch (error) {
    log.error('Extra update failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  }
}

// =============================================================================
// File management (edit mode; alternate versions of the same asset)
// =============================================================================

async function handleAttachFile(): Promise<void> {
  const extra = props.extra
  if (!extra || isAttachingFile.value) return

  isAttachingFile.value = true
  try {
    const picked = await pickVideoFile()
    if (!picked) return

    const result = await ipcManager.invoke('ingest:attach-anime-extra-file', {
      animeId: props.animeId,
      path: picked,
      extraId: extra.id
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
  const extra = props.extra
  if (!extra || file.isPrimary) return
  try {
    await db
      .update(animeExtraFiles)
      .set({ isPrimary: false })
      .where(eq(animeExtraFiles.extraId, extra.id))
    await db.update(animeExtraFiles).set({ isPrimary: true }).where(eq(animeExtraFiles.id, file.id))
    notify.success(m.value.anime.files.primaryUpdated)
  } catch (error) {
    log.error('Set primary file failed:', error)
    notify.error(m.value.library.feedback.updateFailed)
  }
}

async function handleRemoveFile(fileId: string): Promise<void> {
  const extra = props.extra
  if (!extra) return
  try {
    const removed = extra.files.find((file) => file.id === fileId)
    await db.delete(animeExtraFiles).where(eq(animeExtraFiles.id, fileId))

    // Keep exactly one primary among the survivors.
    if (removed?.isPrimary) {
      const survivor = extra.files.find((file) => file.id !== fileId)
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

const deleteDialogOpen = ref(false)

async function handleDelete(): Promise<void> {
  const extra = props.extra
  if (!extra) return
  try {
    await db.delete(animeExtras).where(eq(animeExtras.id, extra.id))
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
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>
          {{ isEditing ? m.anime.extras.editTitle : m.anime.extras.addExtra }}
        </DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody class="space-y-4">
          <Field v-if="!isEditing">
            <FieldLabel>{{ m.anime.files.title }}</FieldLabel>
            <FieldContent>
              <div class="flex items-center gap-2">
                <Input
                  :model-value="filePath"
                  readonly
                  class="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  @click="handlePickFile"
                >
                  {{ m.common.browse }}
                </Button>
              </div>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>{{ m.anime.extras.nameLabel }}</FieldLabel>
            <FieldContent>
              <Input
                v-model="name"
                :placeholder="isEditing ? undefined : m.anime.extras.autoDetect"
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>{{ m.anime.extras.typeLabel }}</FieldLabel>
            <FieldContent>
              <Select v-model="type">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in typeOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>

          <template v-if="isEditing && props.extra">
            <Separator />

            <!-- Alternate version files of this extra -->
            <AnimeFileRecordList
              :files="props.extra.files"
              :empty-text="m.anime.extras.noFiles"
              :attaching="isAttachingFile"
              @attach="handleAttachFile"
              @set-primary="handleSetPrimary"
              @remove-file="handleRemoveFile"
              @open-folder="handleOpenFolder"
              @save-note="handleSaveNote"
            />
          </template>
        </DialogBody>
        <DialogFooter>
          <div class="flex items-center justify-between w-full">
            <Button
              v-if="isEditing"
              type="button"
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
            <div v-else />

            <div class="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                :disabled="isSaving"
                @click="open = false"
              >
                {{ m.common.cancel }}
              </Button>
              <Button
                type="submit"
                :disabled="!canSave"
              >
                {{ m.common.save }}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>

  <!-- Delete confirmation -->
  <DeleteConfirmDialog
    v-if="deleteDialogOpen && props.extra"
    v-model:open="deleteDialogOpen"
    :entity-label="m.anime.extras.entityLabel"
    :entity-name="props.extra.name"
    @confirm="handleDelete"
  />
</template>
