<!--
  TvExtraFormDialog
  Staged form for one extra's fields. Creation picks an on-disk video and may
  leave name/type to filename recognition; editing renames or retypes the
  record. File records and deletion live in the extra detail dialog. Rows
  touched here are user-owned, so file sync stops rewriting them.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { Button } from '@renderer/components/ui/button'
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
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useI18n } from '@renderer/composables/use-i18n'
import type { TvExtraEntry } from '@renderer/composables/use-tv'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { getOpenVideoDialogOptions } from '@renderer/utils/dialog'
import { tvExtras, TV_EXTRA_TYPE_VALUES, type TvExtraType } from '@shared/db'

const log = createLogger('Tv')

interface Props {
  tvId: string
  /** Row to edit; omit to create a new extra from a picked file. */
  extra?: TvExtraEntry
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const isEditing = computed(() => props.extra !== undefined)

/** `auto` defers name and type to filename recognition at attach time. */
type TypeChoice = TvExtraType | 'auto'

const typeOptions = computed<{ value: TypeChoice; label: string }[]>(() => [
  ...(isEditing.value ? [] : [{ value: 'auto' as const, label: m.value.tv.extras.autoDetect }]),
  ...TV_EXTRA_TYPE_VALUES.map((value) => ({
    value,
    label: m.value.library.tvExtraType[value]
  }))
])

const filePath = ref('')
const name = ref('')
const type = ref<TypeChoice>('auto')
const isSaving = ref(false)

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
  const result = await ipcManager.invoke('ingest:attach-tv-extra-file', {
    tvId: props.tvId,
    path: filePath.value,
    ...(name.value.trim() ? { name: name.value.trim() } : {}),
    ...(type.value === 'auto' ? {} : { type: type.value })
  })
  if (!result.success) {
    notify.error(m.value.tv.files.attachFailed, result.error)
    return
  }

  notify.success(m.value.tv.extras.extraAttached)
  open.value = false
}

async function saveEdit(): Promise<void> {
  const extra = props.extra
  if (!extra || type.value === 'auto') return

  try {
    await db
      .update(tvExtras)
      .set({ name: name.value.trim(), type: type.value, isManual: true })
      .where(eq(tvExtras.id, extra.id))
    notify.success(m.value.tv.extras.extraUpdated)
    open.value = false
  } catch (error) {
    log.error('Extra update failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>
          {{ isEditing ? m.tv.extras.editTitle : m.tv.extras.addExtra }}
        </DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody class="space-y-4">
          <Field v-if="!isEditing">
            <FieldLabel>{{ m.tv.files.title }}</FieldLabel>
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
            <FieldLabel>{{ m.tv.extras.nameLabel }}</FieldLabel>
            <FieldContent>
              <Input
                v-model="name"
                :placeholder="isEditing ? undefined : m.tv.extras.autoDetect"
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>{{ m.tv.extras.typeLabel }}</FieldLabel>
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
        </DialogBody>
        <DialogFooter>
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
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
