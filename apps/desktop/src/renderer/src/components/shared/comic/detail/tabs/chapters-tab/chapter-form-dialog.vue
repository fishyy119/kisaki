<!--
  ComicChapterFormDialog
  Create or edit one comic unit at either grain: a collected volume carries a
  volume number, a serialized chapter carries a chapter number. Editing also
  offers deletion of the unit row.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { eq, max } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { comicChapters, type PartialDate } from '@shared/db'
import { useLiveQuery } from '@renderer/composables'
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

const log = createLogger('Library')

interface Props {
  comicId: string
  /** Absent for creation. */
  chapterId?: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const isEditMode = computed(() => !!props.chapterId)

interface FormData {
  volumeNumberText: string
  chapterNumberText: string
  name: string
  releaseDate: PartialDate | null
}

const formData = ref<FormData>({
  volumeNumberText: '',
  chapterNumberText: '',
  name: '',
  releaseDate: null
})
const isSaving = ref(false)
const deleteConfirmOpen = ref(false)
const releaseDateInput = ref<PartialDateInputExpose | null>(null)

const { data: chapter, isLoading } = useLiveQuery(
  async () => {
    if (!props.chapterId) return null
    return (
      (await db.query.comicChapters.findFirst({ where: eq(comicChapters.id, props.chapterId) })) ??
      null
    )
  },
  {
    watch: [() => props.chapterId],
    enabled: () => open.value && isEditMode.value
  }
)

watch(chapter, (row) => {
  if (row) {
    formData.value.volumeNumberText = row.volumeNumber !== null ? String(row.volumeNumber) : ''
    formData.value.chapterNumberText = row.chapterNumber !== null ? String(row.chapterNumber) : ''
    formData.value.name = row.name ?? ''
    formData.value.releaseDate = row.releaseDate ?? null
  }
})

/** Zero is a real unit number: prologues ship as chapter 0 all the time. */
function parseOptionalNumber(text: string): number | null | false {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0) return false
  return value
}

async function handleSubmit() {
  const volumeNumber = parseOptionalNumber(formData.value.volumeNumberText)
  const chapterNumber = parseOptionalNumber(formData.value.chapterNumberText)
  if (volumeNumber === false || chapterNumber === false) {
    notify.error(m.value.comic.chapters.numberInvalid)
    return
  }

  const name = formData.value.name.trim() || null
  if (volumeNumber === null && chapterNumber === null && !name) {
    notify.error(m.value.comic.chapters.numberRequired)
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
    if (isEditMode.value && props.chapterId) {
      await db
        .update(comicChapters)
        .set({ volumeNumber, chapterNumber, name, releaseDate })
        .where(eq(comicChapters.id, props.chapterId))
    } else {
      const [row] = await db
        .select({ value: max(comicChapters.orderInComic) })
        .from(comicChapters)
        .where(eq(comicChapters.comicId, props.comicId))
      await db.insert(comicChapters).values({
        comicId: props.comicId,
        volumeNumber,
        chapterNumber,
        name,
        releaseDate,
        orderInComic: (row?.value ?? -1) + 1
      })
    }

    notify.success(m.value.feedback.saved)
    open.value = false
  } catch (error) {
    log.error('Unit save failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  } finally {
    isSaving.value = false
  }
}

async function handleDelete() {
  if (!props.chapterId) return
  try {
    await db.delete(comicChapters).where(eq(comicChapters.id, props.chapterId))
    notify.success(m.value.comic.chapters.chapterDeleted)
    open.value = false
  } catch (error) {
    log.error('Unit delete failed:', error)
    notify.error(m.value.feedback.deleteFailed)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <!-- Loading state (edit mode only) -->
      <template v-if="isEditMode && (isLoading || !chapter)">
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
            {{ isEditMode ? m.comic.chapters.editChapter : m.comic.chapters.addChapter }}
          </DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
              <div class="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>{{ m.comic.chapters.volumeNumberLabel }}</FieldLabel>
                  <FieldContent>
                    <Input
                      v-model="formData.volumeNumberText"
                      type="number"
                      min="0"
                      step="any"
                      :placeholder="m.comic.chapters.numberPlaceholder"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel>{{ m.comic.chapters.chapterNumberLabel }}</FieldLabel>
                  <FieldContent>
                    <Input
                      v-model="formData.chapterNumberText"
                      type="number"
                      min="0"
                      step="any"
                      :placeholder="m.comic.chapters.numberPlaceholder"
                    />
                  </FieldContent>
                </Field>
              </div>

              <Field>
                <FieldLabel>{{ m.library.fields.name }}</FieldLabel>
                <FieldContent>
                  <Input v-model="formData.name" />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.comic.chapters.releaseDate }}</FieldLabel>
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
                {{ m.comic.chapters.deleteChapter }}
              </Button>
              <div v-else />

              <div class="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  :disabled="isSaving"
                  @click="open = false"
                >
                  {{ m.actions.cancel }}
                </Button>
                <Button
                  type="submit"
                  :disabled="isSaving"
                >
                  {{ m.actions.save }}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </Form>

        <DeleteConfirmDialog
          v-if="deleteConfirmOpen"
          v-model:open="deleteConfirmOpen"
          :entity-label="m.comic.chapters.entityLabel"
          @confirm="handleDelete"
        />
      </template>
    </DialogContent>
  </Dialog>
</template>
