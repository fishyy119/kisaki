<!--
  AnimeDescriptionFormDialog
  Dialog for editing anime description.
-->
<script setup lang="ts">
import { ref, watch, toRef } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { animes } from '@shared/db'
import { useAsyncData, useInlineAttachments } from '@renderer/composables'
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
import { MarkdownEditor } from '@renderer/components/ui/markdown'
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { notify } from '@renderer/core/notify'
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
  description: string
}

const formData = ref<FormData>({
  description: ''
})
const isSaving = ref(false)
const didSave = ref(false)

const { setBaselineContent, onAttachment, gcOnCancel, gcOnSave } = useInlineAttachments({
  table: animes,
  rowId: toRef(props, 'animeId'),
  field: 'descriptionInlineFiles'
})

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
    formData.value.description = animeData.description || ''
    setBaselineContent(formData.value.description)
  }
})

watch(open, async (isOpen, wasOpen) => {
  if (isOpen) {
    didSave.value = false
    return
  }
  if (wasOpen && !didSave.value) {
    try {
      await gcOnCancel()
    } catch (error) {
      log.warn('Inline attachment cleanup failed:', error)
    }
  }
})

async function handleSubmit() {
  isSaving.value = true
  try {
    const next = formData.value.description.trim()
    await db
      .update(animes)
      .set({ description: next || null })
      .where(eq(animes.id, props.animeId))

    await gcOnSave(next)
    didSave.value = true
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
    <DialogContent class="max-w-6xl">
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
          <DialogTitle>{{ m.library.forms.editDescription }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel
                  for="description"
                  class="text-xs"
                >
                  {{ m.library.forms.markdownSupported }}
                </FieldLabel>
                <FieldContent>
                  <MarkdownEditor
                    v-model="formData.description"
                    :placeholder="
                      m.library.forms.descriptionPlaceholder({ label: m.library.entities.anime })
                    "
                    min-height="500px"
                    max-height="500px"
                    :on-attachment="onAttachment"
                    auto-focus
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
