<!--
  NovelVolumeFormDialog
  Create or edit one novel volume. Editing also offers deletion of the
  volume row.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { eq, max } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { novelVolumes, type PartialDate } from '@shared/db'
import { useAsyncData } from '@renderer/composables'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import {
  PartialDateInput,
  type PartialDateInputExpose
} from '@renderer/components/ui/partial-date-input'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import { notify } from '@renderer/core/notify'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Novel')

interface Props {
  novelId: string
  /** Absent for creation. */
  volumeId?: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const isEditMode = computed(() => !!props.volumeId)

interface FormData {
  volumeNumberText: string
  name: string
  releaseDate: PartialDate | null
}

const formData = ref<FormData>({
  volumeNumberText: '',
  name: '',
  releaseDate: null
})
const isSaving = ref(false)
const deleteConfirmOpen = ref(false)
const releaseDateInput = ref<PartialDateInputExpose | null>(null)

const { data: volume, isLoading } = useAsyncData(
  async () => {
    if (!props.volumeId) return null
    return (
      (await db.query.novelVolumes.findFirst({ where: eq(novelVolumes.id, props.volumeId) })) ??
      null
    )
  },
  {
    watch: [() => props.volumeId],
    enabled: () => open.value && isEditMode.value
  }
)

watch(volume, (row) => {
  if (row) {
    formData.value.volumeNumberText = row.volumeNumber !== null ? String(row.volumeNumber) : ''
    formData.value.name = row.name ?? ''
    formData.value.releaseDate = row.releaseDate ?? null
  }
})

async function handleSubmit() {
  const numberText = formData.value.volumeNumberText.trim()
  const volumeNumber = numberText === '' ? null : Number(numberText)
  if (volumeNumber !== null && (!Number.isFinite(volumeNumber) || volumeNumber <= 0)) {
    notify.error(m.value.novel.volumes.numberInvalid)
    return
  }

  const name = formData.value.name.trim() || null
  if (volumeNumber === null && !name) {
    notify.error(m.value.novel.volumes.numberRequired)
    return
  }

  const releaseDateValidation = releaseDateInput.value?.validate()
  if (releaseDateValidation && !releaseDateValidation.valid) {
    notify.error(releaseDateValidation.errorText ?? m.value.library.forms.releaseDateInvalidFormat)
    return
  }
  const releaseDate = releaseDateValidation?.value ?? formData.value.releaseDate

  isSaving.value = true
  try {
    if (isEditMode.value && props.volumeId) {
      await db
        .update(novelVolumes)
        .set({ volumeNumber, name, releaseDate })
        .where(eq(novelVolumes.id, props.volumeId))
    } else {
      const [row] = await db
        .select({ value: max(novelVolumes.orderInNovel) })
        .from(novelVolumes)
        .where(eq(novelVolumes.novelId, props.novelId))
      await db.insert(novelVolumes).values({
        novelId: props.novelId,
        volumeNumber,
        name,
        releaseDate,
        orderInNovel: (row?.value ?? -1) + 1
      })
    }

    notify.success(m.value.common.saved)
    open.value = false
  } catch (error) {
    log.error('Volume save failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  } finally {
    isSaving.value = false
  }
}

async function handleDelete() {
  if (!props.volumeId) return
  try {
    await db.delete(novelVolumes).where(eq(novelVolumes.id, props.volumeId))
    notify.success(m.value.novel.volumes.volumeDeleted)
    open.value = false
  } catch (error) {
    log.error('Volume delete failed:', error)
    notify.error(m.value.common.deleteFailed)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <!-- Loading state (edit mode only) -->
      <template v-if="isEditMode && (isLoading || !volume)">
        <DialogBody>
          <StateView
            state="loading"
            class="py-8"
          />
        </DialogBody>
      </template>

      <!-- Form content -->
      <template v-else>
        <DialogHeader>
          <DialogTitle>
            {{ isEditMode ? m.novel.volumes.editVolume : m.novel.volumes.addVolume }}
          </DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.novel.volumes.numberLabel }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.volumeNumberText"
                    type="number"
                    min="0"
                    step="any"
                    :placeholder="m.novel.volumes.numberPlaceholder"
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.library.fields.name }}</FieldLabel>
                <FieldContent>
                  <Input v-model="formData.name" />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.novel.volumes.releaseDate }}</FieldLabel>
                <FieldContent>
                  <PartialDateInput
                    ref="releaseDateInput"
                    v-model="formData.releaseDate"
                    :messages="{
                      yearDayWithoutMonthText: m.library.forms.releaseDateYearDayWithoutMonth
                    }"
                  />
                </FieldContent>
              </Field>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <div class="flex w-full items-center justify-between">
              <Button
                v-if="isEditMode"
                type="button"
                variant="destructive"
                :disabled="isSaving"
                @click="deleteConfirmOpen = true"
              >
                {{ m.novel.volumes.deleteVolume }}
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
                  :disabled="isSaving"
                >
                  {{ m.common.save }}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </Form>

        <DeleteConfirmDialog
          v-if="deleteConfirmOpen"
          v-model:open="deleteConfirmOpen"
          :entity-label="m.novel.volumes.entityLabel"
          @confirm="handleDelete"
        />
      </template>
    </DialogContent>
  </Dialog>
</template>
