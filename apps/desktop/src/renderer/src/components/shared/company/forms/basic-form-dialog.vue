<!--
  CompanyBasicFormDialog
  Dialog for editing company basic information.
  Uses two-layer pattern: outer handles data fetching, inner handles form state.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { companies, type PartialDate } from '@shared/db'
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
import { Form } from '@renderer/components/ui/form'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { notify } from '@renderer/core/notify'
import {
  PartialDateInput,
  type PartialDateInputExpose
} from '@renderer/components/ui/partial-date-input'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  companyId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

// Form state
interface FormData {
  name: string
  originalName: string
  sortName: string
  foundedDate: PartialDate | null
}

const formData = ref<FormData>({
  name: '',
  originalName: '',
  sortName: '',
  foundedDate: null
})
const isSaving = ref(false)
const foundedDateInput = ref<PartialDateInputExpose | null>(null)

// Fetch company data when dialog opens
const { data: company, isLoading } = useLiveQuery(
  () => db.query.companies.findFirst({ where: eq(companies.id, props.companyId) }),
  {
    watch: [() => props.companyId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(company, (companyData) => {
  if (companyData) {
    formData.value.name = companyData.name || ''
    formData.value.originalName = companyData.originalName || ''
    formData.value.sortName = companyData.sortName || ''
    formData.value.foundedDate = companyData.foundedDate ?? null
  }
})

async function handleSubmit() {
  isSaving.value = true
  try {
    const foundedDateValidation = foundedDateInput.value?.validate()
    if (foundedDateValidation && !foundedDateValidation.valid) {
      notify.error(
        foundedDateValidation.errorText ?? m.value.library.forms.foundedDateInvalidFormat
      )
      return
    }
    const foundedDate = foundedDateValidation?.value ?? formData.value.foundedDate

    await db
      .update(companies)
      .set({
        name: formData.value.name || 'unknown company',
        originalName: formData.value.originalName || null,
        sortName: formData.value.sortName || null,
        foundedDate
      })
      .where(eq(companies.id, props.companyId))
    notify.success(m.value.feedback.saved)
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
    <DialogContent size="md">
      <template v-if="isLoading || !company">
        <DialogBody>
          <StateView
            state="loading"
            class="py-8"
          />
        </DialogBody>
      </template>

      <template v-else>
        <DialogHeader>
          <DialogTitle>{{ m.library.forms.editBasicInfo }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.library.fields.name }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.name"
                    :placeholder="
                      m.library.forms.namePlaceholder({ label: m.library.entities.company })
                    "
                    required
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>{{ m.library.fields.originalName }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.originalName"
                    :placeholder="m.library.forms.originalNamePlaceholder"
                  />
                </FieldContent>
              </Field>
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
                <FieldLabel>{{ m.library.fields.foundedDate }}</FieldLabel>
                <FieldContent>
                  <PartialDateInput
                    ref="foundedDateInput"
                    v-model="formData.foundedDate"
                    :messages="{
                      yearDayWithoutMonthText: m.library.forms.foundedDateYearDayWithoutMonth
                    }"
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
              {{ m.actions.cancel }}
            </Button>
            <Button
              type="submit"
              :disabled="isSaving"
            >
              {{ m.actions.save }}
            </Button>
          </DialogFooter>
        </Form>
      </template>
    </DialogContent>
  </Dialog>
</template>
