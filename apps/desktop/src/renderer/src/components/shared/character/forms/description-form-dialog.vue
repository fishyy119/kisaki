<!--
  CharacterDescriptionFormDialog
  Dialog for editing character description.
-->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { characters } from '@shared/db'
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
import { Field, FieldLabel, FieldContent } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { Button } from '@renderer/components/ui/button'
import { MarkdownEditor } from '@renderer/components/ui/markdown'
import { notify } from '@renderer/core/notify'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Character')

interface Props {
  characterId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

// Form state
interface FormData {
  description: string
}

const formData = ref<FormData>({
  description: ''
})
const isSaving = ref(false)

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
    formData.value.description = characterData.description ?? ''
  }
})

async function handleSubmit() {
  isSaving.value = true
  try {
    const next = formData.value.description.trim()
    await db
      .update(characters)
      .set({ description: next || null })
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
    <DialogContent class="max-w-2xl">
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
          <DialogTitle>{{ m.library.forms.editDescription }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <Field>
              <FieldLabel>{{ m.library.fields.description }}</FieldLabel>
              <FieldContent>
                <MarkdownEditor
                  v-model="formData.description"
                  :placeholder="
                    m.library.forms.descriptionPlaceholder({ label: m.library.entities.character })
                  "
                  min-height="240px"
                />
              </FieldContent>
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
