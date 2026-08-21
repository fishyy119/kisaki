<!--
  CharacterBasicFormDialog
  Dialog for editing character basic information.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { characters, type CupSize, type PartialDate } from '@shared/db'
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

const log = createLogger('Character')

interface Props {
  characterId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

interface FormData {
  name: string
  originalName: string
  sortName: string
  aliases: string
  gender: '' | 'male' | 'female' | 'other'
  birthDate: PartialDate | null
  bloodType: '' | 'a' | 'b' | 'o' | 'ab'
  height: string
  weight: string
  bust: string
  waist: string
  hips: string
  cup: '' | CupSize
  age: string
}

const NONE_VALUE = '#none'
const GENDER_OPTIONS = computed(() => [
  { value: NONE_VALUE, label: m.value.common.none },
  { value: 'male', label: m.value.library.gender.male },
  { value: 'female', label: m.value.library.gender.female },
  { value: 'other', label: m.value.library.gender.other }
])
const BLOOD_TYPE_OPTIONS = computed(() => [
  { value: NONE_VALUE, label: m.value.common.none },
  { value: 'a', label: m.value.library.bloodType.a },
  { value: 'b', label: m.value.library.bloodType.b },
  { value: 'o', label: m.value.library.bloodType.o },
  { value: 'ab', label: m.value.library.bloodType.ab }
])
const CUP_SIZE_OPTIONS = computed(() => [
  { value: NONE_VALUE, label: m.value.common.none },
  { value: 'aaa', label: 'AAA' },
  { value: 'aa', label: 'AA' },
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
  { value: 'd', label: 'D' },
  { value: 'e', label: 'E' },
  { value: 'f', label: 'F' },
  { value: 'g', label: 'G' },
  { value: 'h', label: 'H' },
  { value: 'i', label: 'I' },
  { value: 'j', label: 'J' },
  { value: 'k', label: 'K' }
])

// Form state
const formData = ref<FormData>({
  name: '',
  originalName: '',
  sortName: '',
  aliases: '',
  gender: '',
  birthDate: null,
  bloodType: '',
  height: '',
  weight: '',
  bust: '',
  waist: '',
  hips: '',
  cup: '',
  age: ''
})
const isSaving = ref(false)
const birthDateInput = ref<PartialDateInputExpose | null>(null)

// Fetch character data when dialog opens
const { data: character, isLoading } = useAsyncData(
  () => db.query.characters.findFirst({ where: eq(characters.id, props.characterId) }),
  {
    watch: [() => props.characterId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(character, (characterData) => {
  if (characterData) {
    formData.value = {
      name: characterData.name || '',
      originalName: characterData.originalName || '',
      sortName: characterData.sortName || '',
      aliases: (characterData.aliases ?? []).join(', '),
      gender: characterData.gender || '',
      birthDate: characterData.birthDate ?? null,
      bloodType: characterData.bloodType || '',
      height: characterData.height?.toString() || '',
      weight: characterData.weight?.toString() || '',
      bust: characterData.bust?.toString() || '',
      waist: characterData.waist?.toString() || '',
      hips: characterData.hips?.toString() || '',
      cup: characterData.cup || '',
      age: characterData.age?.toString() || ''
    }
  }
})

// Computed models to handle NONE_VALUE <-> empty string conversion
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

const bloodTypeModel = computed({
  get: () => formData.value.bloodType || NONE_VALUE,
  set: (v: unknown) => {
    if (v === NONE_VALUE) {
      formData.value.bloodType = ''
      return
    }
    if (v === 'a' || v === 'b' || v === 'o' || v === 'ab') {
      formData.value.bloodType = v
    }
  }
})

const cupModel = computed({
  get: () => formData.value.cup || NONE_VALUE,
  set: (v: unknown) => {
    if (v === NONE_VALUE) {
      formData.value.cup = ''
      return
    }
    if (typeof v === 'string' && isCupSize(v)) {
      formData.value.cup = v
    }
  }
})

function isCupSize(value: string): value is CupSize {
  return value !== NONE_VALUE && CUP_SIZE_OPTIONS.value.some((o) => o.value === value)
}

async function handleSubmit() {
  isSaving.value = true
  try {
    const birthDateValidation = birthDateInput.value?.validate()
    if (birthDateValidation && !birthDateValidation.valid) {
      notify.error(birthDateValidation.errorText ?? m.value.library.forms.birthDateInvalidFormat)
      return
    }
    const birthDate = birthDateValidation?.value ?? formData.value.birthDate

    await db
      .update(characters)
      .set({
        name: formData.value.name || 'unknown character',
        originalName: formData.value.originalName || null,
        sortName: formData.value.sortName || null,
        aliases: parseAliasesInput(formData.value.aliases),
        gender: formData.value.gender || null,
        birthDate,
        bloodType: formData.value.bloodType || null,
        height: formData.value.height ? parseInt(formData.value.height, 10) : null,
        weight: formData.value.weight ? parseInt(formData.value.weight, 10) : null,
        bust: formData.value.bust ? parseInt(formData.value.bust, 10) : null,
        waist: formData.value.waist ? parseInt(formData.value.waist, 10) : null,
        hips: formData.value.hips ? parseInt(formData.value.hips, 10) : null,
        cup: formData.value.cup || null,
        age: formData.value.age ? parseInt(formData.value.age, 10) : null
      })
      .where(eq(characters.id, props.characterId))

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
      <template v-if="isLoading || !character">
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
          <DialogTitle>{{ m.library.forms.editBasicInfo }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody class="max-h-[60vh] overflow-auto">
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.library.fields.name }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.name"
                    :placeholder="
                      m.library.forms.namePlaceholder({ label: m.library.entities.character })
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
                <FieldLabel>{{ m.library.fields.aliases }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.aliases"
                    :placeholder="m.library.forms.aliasesPlaceholder"
                  />
                </FieldContent>
              </Field>
              <div class="grid grid-cols-2 gap-4">
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
                <Field>
                  <FieldLabel>{{ m.library.fields.age }}</FieldLabel>
                  <FieldContent>
                    <Input
                      v-model="formData.age"
                      type="number"
                      min="0"
                      :placeholder="m.library.forms.agePlaceholder"
                    />
                  </FieldContent>
                </Field>
              </div>
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
                  <FieldLabel>{{ m.library.fields.bloodType }}</FieldLabel>
                  <FieldContent>
                    <Select v-model="bloodTypeModel">
                      <SelectTrigger class="w-full">
                        <SelectValue :placeholder="m.library.forms.selectBloodType" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in BLOOD_TYPE_OPTIONS"
                          :key="opt.value"
                          :value="opt.value"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>{{ m.library.fields.height }}</FieldLabel>
                  <FieldContent>
                    <Input
                      v-model="formData.height"
                      type="number"
                      min="0"
                      placeholder="cm"
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>{{ m.library.fields.weight }}</FieldLabel>
                  <FieldContent>
                    <Input
                      v-model="formData.weight"
                      type="number"
                      min="0"
                      placeholder="kg"
                    />
                  </FieldContent>
                </Field>
              </div>
              <div class="grid grid-cols-4 gap-4">
                <Field>
                  <FieldLabel>B</FieldLabel>
                  <FieldContent>
                    <Input
                      v-model="formData.bust"
                      type="number"
                      min="0"
                      placeholder="cm"
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>W</FieldLabel>
                  <FieldContent>
                    <Input
                      v-model="formData.waist"
                      type="number"
                      min="0"
                      placeholder="cm"
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>H</FieldLabel>
                  <FieldContent>
                    <Input
                      v-model="formData.hips"
                      type="number"
                      min="0"
                      placeholder="cm"
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>{{ m.library.fields.cup }}</FieldLabel>
                  <FieldContent>
                    <Select v-model="cupModel">
                      <SelectTrigger class="w-full">
                        <SelectValue :placeholder="m.library.fields.cup" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in CUP_SIZE_OPTIONS"
                          :key="opt.value"
                          :value="opt.value"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>
              </div>
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
