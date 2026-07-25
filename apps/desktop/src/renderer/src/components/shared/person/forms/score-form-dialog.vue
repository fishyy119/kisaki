<!--
  PersonScoreFormDialog
  Dialog for editing person score.
  Uses two-layer pattern: outer handles data fetching, inner handles form state.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { persons } from '@shared/db'
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
import { Field, FieldLabel, FieldContent, FieldDescription } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { notify } from '@renderer/core/notify'
import { dbScoreToDisplay, displayScoreToDb } from '@renderer/utils/format'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Person')

interface Props {
  personId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

// Form state
interface FormData {
  score: string
}

const formData = ref<FormData>({
  score: ''
})
const isSaving = ref(false)

// Fetch person data when dialog opens
const { data: person, isLoading } = useAsyncData(
  () => db.query.persons.findFirst({ where: eq(persons.id, props.personId) }),
  {
    watch: [() => props.personId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(person, (personData) => {
  if (personData) {
    formData.value.score = dbScoreToDisplay(personData.score)
  }
})

// Computed model for score input (validates input pattern)
const scoreModel = computed({
  get: () => formData.value.score,
  set: (value: string) => {
    if (value === '' || /^(\d+\.?\d*)?$/.test(value)) {
      formData.value.score = value
    }
  }
})

async function handleSubmit() {
  const trimmed = formData.value.score.trim()
  if (trimmed !== '') {
    const num = parseFloat(trimmed)
    if (isNaN(num) || num < 0 || num > 10) {
      notify.error(m.value.library.forms.scoreOutOfRange)
      return
    }
  }

  isSaving.value = true
  try {
    await db
      .update(persons)
      .set({ score: displayScoreToDb(formData.value.score) })
      .where(eq(persons.id, props.personId))

    notify.success(m.value.common.saved)
    open.value = false
  } catch (error) {
    log.error('Update failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  } finally {
    isSaving.value = false
  }
}

function handleClear() {
  formData.value.score = ''
}

function handleCancel() {
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
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
          <DialogTitle>{{ m.library.forms.editScore }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <Field>
              <FieldLabel>{{ m.library.fields.myScore }}</FieldLabel>
              <FieldContent>
                <div class="flex gap-2 items-center">
                  <Input
                    v-model="scoreModel"
                    type="text"
                    inputmode="decimal"
                    placeholder="0.0"
                    class="w-24"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    @click="handleClear"
                  >
                    {{ m.common.clear }}
                  </Button>
                </div>
              </FieldContent>
              <FieldDescription>{{ m.library.forms.scoreRangeHint }}</FieldDescription>
            </Field>
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
