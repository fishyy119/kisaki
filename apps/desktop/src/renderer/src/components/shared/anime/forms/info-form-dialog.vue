<!--
  AnimeInfoFormDialog
  Dialog for editing anime info (sort name, release date, created date).
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { animes, type PartialDate } from '@shared/db'
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
import { notify } from '@renderer/core/notify'
import {
  PartialDateInput,
  type PartialDateInputExpose
} from '@renderer/components/ui/partial-date-input'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Anime')

interface Props {
  animeId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

// Form state
interface FormData {
  sortName: string
  releaseDate: PartialDate | null
  createdAt: string
}

const formData = ref<FormData>({
  sortName: '',
  releaseDate: null,
  createdAt: ''
})
const isSaving = ref(false)
const releaseDateInput = ref<PartialDateInputExpose | null>(null)

// Fetch anime data when dialog opens
const { data: anime, isLoading } = useAsyncData(
  () => db.query.animes.findFirst({ where: eq(animes.id, props.animeId) }),
  {
    watch: [() => props.animeId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(anime, (animeData) => {
  if (animeData) {
    formData.value.sortName = animeData.sortName || ''
    formData.value.releaseDate = animeData.releaseDate ?? null
    formData.value.createdAt = formatDateInput(animeData.createdAt)
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

    await db
      .update(animes)
      .set({
        sortName: formData.value.sortName || null,
        releaseDate,
        createdAt: new Date(formData.value.createdAt)
      })
      .where(eq(animes.id, props.animeId))

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
      <template v-if="isLoading || !anime">
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
