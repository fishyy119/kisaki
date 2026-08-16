<!--
  MovieInfoFormDialog
  Dialog for editing movie info (sort name, format, runtime, release date,
  created date).
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { movies, MOVIE_FORMAT_VALUES, type MovieFormat, type PartialDate } from '@shared/db'
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

const log = createLogger('Movie')

/** Runtime is stored in milliseconds but only ever entered in whole minutes. */
const MS_PER_MINUTE = 60_000

interface Props {
  movieId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const FORMAT_OPTIONS = computed<{ value: MovieFormat; label: string }[]>(() =>
  MOVIE_FORMAT_VALUES.map((value) => ({ value, label: m.value.library.movieFormat[value] }))
)

// Form state
interface FormData {
  sortName: string
  format: MovieFormat
  runtimeMinutes: string
  releaseDate: PartialDate | null
  createdAt: string
}

const formData = ref<FormData>({
  sortName: '',
  format: 'theatrical',
  runtimeMinutes: '',
  releaseDate: null,
  createdAt: ''
})
const isSaving = ref(false)
const releaseDateInput = ref<PartialDateInputExpose | null>(null)

// Fetch movie data when dialog opens
const { data: movie, isLoading } = useAsyncData(
  () => db.query.movies.findFirst({ where: eq(movies.id, props.movieId) }),
  {
    watch: [() => props.movieId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(movie, (movieData) => {
  if (movieData) {
    formData.value.sortName = movieData.sortName || ''
    formData.value.format = movieData.format
    formData.value.runtimeMinutes =
      movieData.runtimeMs !== null ? String(Math.round(movieData.runtimeMs / MS_PER_MINUTE)) : ''
    formData.value.releaseDate = movieData.releaseDate ?? null
    formData.value.createdAt = formatDateInput(movieData.createdAt)
  }
})

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

    const runtimeText = formData.value.runtimeMinutes.trim()
    const runtimeMinutes = runtimeText === '' ? null : Number(runtimeText)
    if (runtimeMinutes !== null && (!Number.isFinite(runtimeMinutes) || runtimeMinutes <= 0)) {
      notify.error(m.value.library.forms.runtimeInvalid)
      return
    }

    await db
      .update(movies)
      .set({
        sortName: formData.value.sortName || null,
        format: formData.value.format,
        runtimeMs: runtimeMinutes === null ? null : Math.round(runtimeMinutes * MS_PER_MINUTE),
        releaseDate,
        createdAt: new Date(formData.value.createdAt)
      })
      .where(eq(movies.id, props.movieId))

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
      <template v-if="isLoading || !movie">
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
                <FieldLabel>{{ m.library.fields.runtime }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.runtimeMinutes"
                    type="number"
                    min="0"
                    :placeholder="m.library.forms.runtimeMinutesPlaceholder"
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
