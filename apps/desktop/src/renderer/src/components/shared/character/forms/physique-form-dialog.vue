<!--
  CharacterPhysiqueFormDialog
  Dialog for editing a character's physique: height, weight, the bust-waist-hips
  triple, and cup size. Kept apart from the details editor because sources
  publish physique as its own field family, and most characters have none.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { characters, type CupSize } from '@shared/db'
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
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  characterId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

interface FormData {
  height: string
  weight: string
  bust: string
  waist: string
  hips: string
  cup: '' | CupSize
}

const NONE_VALUE = '#none'
const CUP_SIZE_OPTIONS = computed(() => [
  { value: NONE_VALUE, label: m.value.states.none },
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
  height: '',
  weight: '',
  bust: '',
  waist: '',
  hips: '',
  cup: ''
})
const isSaving = ref(false)

// Fetch character data when dialog opens
const { data: character, isLoading } = useLiveQuery(
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
      height: characterData.height?.toString() || '',
      weight: characterData.weight?.toString() || '',
      bust: characterData.bust?.toString() || '',
      waist: characterData.waist?.toString() || '',
      hips: characterData.hips?.toString() || '',
      cup: characterData.cup || ''
    }
  }
})

// Computed model to handle NONE_VALUE <-> empty string conversion
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

function toMeasurement(value: string): number | null {
  return value ? parseInt(value, 10) : null
}

async function handleSubmit() {
  isSaving.value = true
  try {
    await db
      .update(characters)
      .set({
        height: toMeasurement(formData.value.height),
        weight: toMeasurement(formData.value.weight),
        bust: toMeasurement(formData.value.bust),
        waist: toMeasurement(formData.value.waist),
        hips: toMeasurement(formData.value.hips),
        cup: formData.value.cup || null
      })
      .where(eq(characters.id, props.characterId))

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
          <DialogTitle>{{ m.library.forms.editPhysique }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
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
