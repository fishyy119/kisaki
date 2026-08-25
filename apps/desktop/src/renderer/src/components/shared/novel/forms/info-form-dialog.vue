<!--
  NovelInfoFormDialog
  Dialog for editing novel info (sort name, aliases, format, volume count,
  release date, created date).
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { NOVEL_FORMAT_VALUES, novels, type NovelFormat, type PartialDate } from '@shared/db'
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

const log = createLogger('Novel')

interface Props {
  novelId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const FORMAT_OPTIONS = computed<{ value: NovelFormat; label: string }[]>(() =>
  NOVEL_FORMAT_VALUES.map((value) => ({ value, label: m.value.library.novelFormat[value] }))
)

// Form state
interface FormData {
  sortName: string
  aliases: string
  format: NovelFormat
  totalVolumes: string
  releaseDate: PartialDate | null
  createdAt: string
}

const formData = ref<FormData>({
  sortName: '',
  aliases: '',
  format: 'lightNovel',
  totalVolumes: '',
  releaseDate: null,
  createdAt: ''
})
const isSaving = ref(false)
const releaseDateInput = ref<PartialDateInputExpose | null>(null)

// Fetch novel data when dialog opens
const { data: novel, isLoading } = useAsyncData(
  () => db.query.novels.findFirst({ where: eq(novels.id, props.novelId) }),
  {
    watch: [() => props.novelId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(novel, (novelData) => {
  if (novelData) {
    formData.value.sortName = novelData.sortName || ''
    formData.value.aliases = (novelData.aliases ?? []).join(', ')
    formData.value.format = novelData.format
    formData.value.totalVolumes =
      novelData.totalVolumes !== null ? String(novelData.totalVolumes) : ''
    formData.value.releaseDate = novelData.releaseDate ?? null
    formData.value.createdAt = formatDateInput(novelData.createdAt)
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

    const totalVolumesText = formData.value.totalVolumes.trim()
    const totalVolumes = totalVolumesText === '' ? null : Number(totalVolumesText)
    if (totalVolumes !== null && (!Number.isInteger(totalVolumes) || totalVolumes < 0)) {
      notify.error(m.value.library.forms.totalVolumesInvalid)
      return
    }

    await db
      .update(novels)
      .set({
        sortName: formData.value.sortName || null,
        aliases: parseAliasesInput(formData.value.aliases),
        format: formData.value.format,
        totalVolumes,
        releaseDate,
        createdAt: new Date(formData.value.createdAt)
      })
      .where(eq(novels.id, props.novelId))

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
      <template v-if="isLoading || !novel">
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
                <FieldLabel>{{ m.library.fields.totalVolumes }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.totalVolumes"
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
