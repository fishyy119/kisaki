<!--
  PersonInfoFormDialog
  Dialog for editing a person's details: sort name, aliases, gender, life dates,
  and the date it entered the library. Name, original name, and score are hero
  fields with their own editors.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { persons, type PartialDate } from '@shared/db'
import { useLiveQuery } from '@renderer/composables'
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
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Form } from '@renderer/components/ui/form'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { notify } from '@renderer/core/notify'
import {
  PartialDateInput,
  type PartialDateInputExpose
} from '@renderer/components/ui/partial-date-input'
import { createLogger } from '@renderer/core/log'
import { parseAliasesInput } from '@renderer/utils/format'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  personId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

interface FormData {
  sortName: string
  aliases: string
  gender: '' | 'male' | 'female' | 'other'
  birthDate: PartialDate | null
  deathDate: PartialDate | null
  createdAt: string
}

const NONE_VALUE = '#none'
const GENDER_OPTIONS = computed(() => [
  { value: NONE_VALUE, label: m.value.states.none },
  { value: 'male', label: m.value.library.gender.male },
  { value: 'female', label: m.value.library.gender.female },
  { value: 'other', label: m.value.library.gender.other }
])

// Form state
const formData = ref<FormData>({
  sortName: '',
  aliases: '',
  gender: '',
  birthDate: null,
  deathDate: null,
  createdAt: ''
})
const isSaving = ref(false)
const birthDateInput = ref<PartialDateInputExpose | null>(null)
const deathDateInput = ref<PartialDateInputExpose | null>(null)

// Fetch person data when dialog opens
const { data: person, isLoading } = useLiveQuery(
  () => db.query.persons.findFirst({ where: eq(persons.id, props.personId) }),
  {
    watch: [() => props.personId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(person, (personData) => {
  if (personData) {
    formData.value = {
      sortName: personData.sortName || '',
      aliases: (personData.aliases ?? []).join(', '),
      gender: personData.gender || '',
      birthDate: personData.birthDate ?? null,
      deathDate: personData.deathDate ?? null,
      createdAt: formatDateInput(personData.createdAt)
    }
  }
})

// Computed model to handle NONE_VALUE <-> empty string conversion
const genderModel = computed({
  get: () => formData.value.gender || NONE_VALUE,
  set: (v: unknown) => {
    if (v === NONE_VALUE) {
      formData.value.gender = ''
      return
    }
    if (v === 'male' || v === 'female' || v === 'other') {
      formData.value.gender = v
    }
  }
})

async function handleSubmit() {
  isSaving.value = true
  try {
    const birthDateValidation = birthDateInput.value?.validate()
    if (birthDateValidation && !birthDateValidation.valid) {
      notify.error(birthDateValidation.errorText ?? m.value.library.forms.birthDateInvalidFormat)
      return
    }
    const birthDate = birthDateValidation?.value ?? formData.value.birthDate

    const deathDateValidation = deathDateInput.value?.validate()
    if (deathDateValidation && !deathDateValidation.valid) {
      notify.error(deathDateValidation.errorText ?? m.value.library.forms.deathDateInvalidFormat)
      return
    }
    const deathDate = deathDateValidation?.value ?? formData.value.deathDate

    await db
      .update(persons)
      .set({
        sortName: formData.value.sortName || null,
        aliases: parseAliasesInput(formData.value.aliases),
        gender: formData.value.gender || null,
        birthDate,
        deathDate,
        createdAt: new Date(formData.value.createdAt)
      })
      .where(eq(persons.id, props.personId))

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
    <DialogContent class="max-w-lg">
      <!-- Loading state -->
      <template v-if="isLoading || !person">
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
          <DialogBody class="max-h-[60vh]">
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
                <FieldLabel>{{ m.library.fields.gender }}</FieldLabel>
                <FieldContent>
                  <Select v-model="genderModel">
                    <SelectTrigger class="w-full">
                      <SelectValue :placeholder="m.library.forms.selectGender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in GENDER_OPTIONS"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
              <div class="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>{{ m.library.fields.birthDate }}</FieldLabel>
                  <FieldContent>
                    <PartialDateInput
                      ref="birthDateInput"
                      v-model="formData.birthDate"
                      :messages="{ invalidIntegerText: m.library.forms.birthDateInvalidInteger }"
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>{{ m.library.fields.deathDate }}</FieldLabel>
                  <FieldContent>
                    <PartialDateInput
                      ref="deathDateInput"
                      v-model="formData.deathDate"
                      :messages="{ invalidIntegerText: m.library.forms.deathDateInvalidInteger }"
                    />
                  </FieldContent>
                </Field>
              </div>
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
