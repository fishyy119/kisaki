<!--
  TvInfoFormDialog
  Dialog for editing series info (sort name, format, season and episode counts,
  first air date, last aired date, created date).
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { tvs, TV_FORMAT_VALUES, type TvFormat, type PartialDate } from '@shared/db'
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
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Tv')

interface Props {
  tvId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const FORMAT_OPTIONS = computed<{ value: TvFormat; label: string }[]>(() =>
  TV_FORMAT_VALUES.map((value) => ({ value, label: m.value.library.tvFormat[value] }))
)

// Form state
interface FormData {
  sortName: string
  format: TvFormat
  totalSeasons: string
  totalEpisodes: string
  releaseDate: PartialDate | null
  endDate: PartialDate | null
  createdAt: string
}

const formData = ref<FormData>({
  sortName: '',
  format: 'scripted',
  totalSeasons: '',
  totalEpisodes: '',
  releaseDate: null,
  endDate: null,
  createdAt: ''
})
const isSaving = ref(false)
const releaseDateInput = ref<PartialDateInputExpose | null>(null)
const endDateInput = ref<PartialDateInputExpose | null>(null)

// Fetch series data when dialog opens
const { data: tv, isLoading } = useAsyncData(
  () => db.query.tvs.findFirst({ where: eq(tvs.id, props.tvId) }),
  {
    watch: [() => props.tvId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(tv, (tvData) => {
  if (tvData) {
    formData.value.sortName = tvData.sortName || ''
    formData.value.format = tvData.format
    formData.value.totalSeasons = tvData.totalSeasons !== null ? String(tvData.totalSeasons) : ''
    formData.value.totalEpisodes = tvData.totalEpisodes !== null ? String(tvData.totalEpisodes) : ''
    formData.value.releaseDate = tvData.releaseDate ?? null
    formData.value.endDate = tvData.endDate ?? null
    formData.value.createdAt = formatDateInput(tvData.createdAt)
  }
})

/** Reads a count field, returning `false` when the text is not a valid count. */
function readCount(text: string): number | null | false {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isInteger(value) && value >= 0 ? value : false
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

    const endDateValidation = endDateInput.value?.validate()
    if (endDateValidation && !endDateValidation.valid) {
      notify.error(endDateValidation.errorText ?? m.value.library.forms.endDateInvalidFormat)
      return
    }
    const endDate = endDateValidation?.value ?? formData.value.endDate

    const totalSeasons = readCount(formData.value.totalSeasons)
    if (totalSeasons === false) {
      notify.error(m.value.library.forms.totalSeasonsInvalid)
      return
    }

    const totalEpisodes = readCount(formData.value.totalEpisodes)
    if (totalEpisodes === false) {
      notify.error(m.value.library.forms.totalEpisodesInvalid)
      return
    }

    await db
      .update(tvs)
      .set({
        sortName: formData.value.sortName || null,
        format: formData.value.format,
        totalSeasons,
        totalEpisodes,
        releaseDate,
        endDate,
        createdAt: new Date(formData.value.createdAt)
      })
      .where(eq(tvs.id, props.tvId))

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
      <template v-if="isLoading || !tv">
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
                <FieldLabel>{{ m.library.fields.totalSeasons }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.totalSeasons"
                    type="number"
                    min="0"
                    :placeholder="m.library.forms.totalEpisodesPlaceholder"
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.library.fields.totalEpisodes }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.totalEpisodes"
                    type="number"
                    min="0"
                    :placeholder="m.library.forms.totalEpisodesPlaceholder"
                  />
                </FieldContent>
              </Field>

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
                <FieldLabel>{{ m.library.fields.endDate }}</FieldLabel>
                <FieldContent>
                  <PartialDateInput
                    ref="endDateInput"
                    v-model="formData.endDate"
                    :messages="{
                      yearDayWithoutMonthText: m.library.forms.endDateYearDayWithoutMonth
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
