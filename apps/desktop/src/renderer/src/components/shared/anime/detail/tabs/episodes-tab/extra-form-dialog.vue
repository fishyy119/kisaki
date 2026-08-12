<!--
  AnimeExtraFormDialog
  Creates or edits an extra. Creation picks an on-disk video and may leave
  name/kind to filename recognition; editing offers deletion. Rows touched
  here are user-owned, so file sync stops rewriting them.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useI18n } from '@renderer/composables/use-i18n'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { getOpenVideoDialogOptions } from '@renderer/utils/dialog'
import { animeExtras, type AnimeExtra, type AnimeExtraKind } from '@shared/db'

const log = createLogger('Anime')

interface Props {
  animeId: string
  /** Row to edit; omit to create a new extra from a picked file. */
  extra?: AnimeExtra
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const isEditing = computed(() => props.extra !== undefined)

/** `auto` defers name and kind to filename recognition at attach time. */
type KindChoice = AnimeExtraKind | 'auto'

const KIND_VALUES = ['trailer', 'pv', 'ncop', 'nced', 'interview', 'other'] as const

const kindOptions = computed<{ value: KindChoice; label: string }[]>(() => [
  ...(isEditing.value
    ? []
    : [{ value: 'auto' as const, label: m.value.anime.extras.autoDetect }]),
  ...KIND_VALUES.map((value) => ({ value, label: m.value.library.animeExtraKind[value] }))
])

const filePath = ref('')
const name = ref('')
const kind = ref<KindChoice>('auto')
const isSaving = ref(false)

watch(
  () => props.extra,
  (extra) => {
    filePath.value = extra?.path ?? ''
    name.value = extra?.name ?? ''
    kind.value = extra?.kind ?? 'auto'
  },
  { immediate: true }
)

const canSave = computed(() => {
  if (isSaving.value) return false
  if (!isEditing.value) return filePath.value.length > 0
  return name.value.trim().length > 0
})

async function handlePickFile(): Promise<void> {
  const dialogResult = await ipcManager.invoke('native:open-dialog', getOpenVideoDialogOptions())
  if (!dialogResult.success) {
    notify.error(dialogResult.error || m.value.library.feedback.pickFileFailed)
    return
  }
  const picked = dialogResult.data?.filePaths[0]
  if (!picked || dialogResult.data?.canceled) return
  filePath.value = picked
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
    ...(kind.value === 'auto' ? {} : { kind: kind.value })
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
  if (!extra || kind.value === 'auto') return

  try {
    await db
      .update(animeExtras)
      .set({ name: name.value.trim(), kind: kind.value, isManual: true })
      .where(eq(animeExtras.id, extra.id))
    notify.success(m.value.anime.extras.extraUpdated)
    open.value = false
  } catch (error) {
    log.error('Extra update failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
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
            <FieldLabel>{{ m.anime.extras.kindLabel }}</FieldLabel>
            <FieldContent>
              <Select v-model="kind">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in kindOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>

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
