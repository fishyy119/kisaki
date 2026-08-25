<!--
  ComicInfoFormDialog
  Dialog for editing comic info (sort name, aliases, format, reading direction,
  volume/chapter counts, release date, created date).
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import {
  COMIC_FORMAT_VALUES,
  COMIC_READING_DIRECTION_VALUES,
  comics,
  type ComicFormat,
  type ComicReadingDirection,
  type PartialDate
} from '@shared/db'
import { useAsyncData } from '@renderer/composables'
import { formatDateInput } from '@renderer/utils/datetime'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { notify } from '@renderer/core/notify'
import {
  PartialDateInput,
  type PartialDateInputExpose
} from '@renderer/components/ui/partial-date-input'
import { createLogger } from '@renderer/core/log'
import { parseAliasesInput } from '@renderer/utils/format'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Comic')

interface Props {
  comicId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const FORMAT_OPTIONS = computed<{ value: ComicFormat; label: string }[]>(() =>
  COMIC_FORMAT_VALUES.map((value) => ({ value, label: m.value.library.comicFormat[value] }))
)

/** Absent direction follows the format default, so the select carries an empty member. */
const DIRECTION_UNSET = 'default'

/** Select values are the direction union plus the "follow the format" member. */
type DirectionChoice = ComicReadingDirection | typeof DIRECTION_UNSET

const DIRECTION_OPTIONS = computed<{ value: DirectionChoice; label: string }[]>(() => [
  { value: DIRECTION_UNSET, label: m.value.common.emptyValue },
  ...COMIC_READING_DIRECTION_VALUES.map((value) => ({
    value,
    label: m.value.library.readingDirection[value]
  }))
])

// Form state
interface FormData {
  sortName: string
  aliases: string
  format: ComicFormat
  readingDirection: DirectionChoice
  totalVolumes: string
  totalChapters: string
  releaseDate: PartialDate | null
  createdAt: string
}

const formData = ref<FormData>({
  sortName: '',
  aliases: '',
  format: 'manga',
  readingDirection: DIRECTION_UNSET,
  totalVolumes: '',
  totalChapters: '',
  releaseDate: null,
  createdAt: ''
})
const isSaving = ref(false)
const releaseDateInput = ref<PartialDateInputExpose | null>(null)

// Fetch comic data when dialog opens
const { data: comic, isLoading } = useAsyncData(
  () => db.query.comics.findFirst({ where: eq(comics.id, props.comicId) }),
  {
    watch: [() => props.comicId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(comic, (comicData) => {
  if (comicData) {
    formData.value.sortName = comicData.sortName || ''
    formData.value.aliases = (comicData.aliases ?? []).join(', ')
    formData.value.format = comicData.format
    formData.value.readingDirection = comicData.readingDirection ?? DIRECTION_UNSET
    formData.value.totalVolumes =
      comicData.totalVolumes !== null ? String(comicData.totalVolumes) : ''
    formData.value.totalChapters =
      comicData.totalChapters !== null ? String(comicData.totalChapters) : ''
    formData.value.releaseDate = comicData.releaseDate ?? null
    formData.value.createdAt = formatDateInput(comicData.createdAt)
  }
})

function parseOptionalCount(text: string, invalidMessage: string): number | null | false {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  if (!Number.isInteger(value) || value < 0) {
    notify.error(invalidMessage)
    return false
  }
  return value
}

async function handleSubmit() {
  isSaving.value = true
  try {
    const releaseDateValidation = releaseDateInput.value?.validate()
    if (releaseDateValidation && !releaseDateValidation.valid) {
      notify.error(
        releaseDateValidation.errorText ?? m.value.library.forms.releaseDateInvalidFormat
      )
      return
    }
    const releaseDate = releaseDateValidation?.value ?? formData.value.releaseDate

    const totalVolumes = parseOptionalCount(
      formData.value.totalVolumes,
      m.value.library.forms.totalVolumesInvalid
    )
    if (totalVolumes === false) return
    const totalChapters = parseOptionalCount(
      formData.value.totalChapters,
      m.value.library.forms.totalChaptersInvalid
    )
    if (totalChapters === false) return

    await db
      .update(comics)
      .set({
        sortName: formData.value.sortName || null,
        aliases: parseAliasesInput(formData.value.aliases),
        format: formData.value.format,
        readingDirection:
          formData.value.readingDirection === DIRECTION_UNSET
            ? null
            : formData.value.readingDirection,
        totalVolumes,
        totalChapters,
        releaseDate,
        createdAt: new Date(formData.value.createdAt)
      })
      .where(eq(comics.id, props.comicId))

    notify.success(m.value.common.saved)
    open.value = false
  } catch (error) {
    log.error('Update failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  } finally {
    isSaving.value = false
  }
}

function handleCancel() {
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <!-- Loading state -->
      <template v-if="isLoading || !comic">
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
          <DialogTitle>{{ m.library.forms.editDetails }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.library.fields.sortName }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.sortName"
                    :placeholder="m.library.forms.sortNamePlaceholder"
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.library.fields.aliases }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.aliases"
                    :placeholder="m.library.forms.aliasesPlaceholder"
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.library.fields.format }}</FieldLabel>
                <FieldContent>
                  <Select v-model="formData.format">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in FORMAT_OPTIONS"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.library.fields.readingDirection }}</FieldLabel>
                <FieldContent>
                  <Select v-model="formData.readingDirection">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in DIRECTION_OPTIONS"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <div class="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel>{{ m.library.fields.totalVolumes }}</FieldLabel>
                  <FieldContent>
                    <Input
                      v-model="formData.totalVolumes"
                      type="number"
                      min="0"
                      :placeholder="m.library.forms.countPlaceholder"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel>{{ m.library.fields.totalChapters }}</FieldLabel>
                  <FieldContent>
                    <Input
                      v-model="formData.totalChapters"
                      type="number"
                      min="0"
                      :placeholder="m.library.forms.countPlaceholder"
                    />
                  </FieldContent>
                </Field>
              </div>

              <Field>
                <FieldLabel>{{ m.library.fields.releaseDate }}</FieldLabel>
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

              <Field>
                <FieldLabel>{{ m.library.fields.addedDate }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.createdAt"
                    type="date"
                  />
                </FieldContent>
              </Field>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="isSaving"
              @click="handleCancel"
            >
              {{ m.common.cancel }}
            </Button>
            <Button
              type="submit"
              :disabled="isSaving"
            >
              {{ m.common.save }}
            </Button>
          </DialogFooter>
        </Form>
      </template>
    </DialogContent>
  </Dialog>
</template>
