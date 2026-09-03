<!--
  MediaDescriptionFormDialog
  Dialog for editing a media entry's markdown description with inline image
  attachments; media differences arrive as the `mediaType` registry key only.
-->
<script setup lang="ts">
import { ref, watch, toRef, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { db, updateEntityRows } from '@renderer/core/db'
import type { MediaType } from '@shared/entity-types'
import { useLiveQuery, useInlineAttachments } from '@renderer/composables'
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
import { animes, comics, games, novels } from '@shared/db'
import { MEDIA_TABLES } from '../media-tables'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  mediaType: MediaType
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const table = computed(() => MEDIA_TABLES[props.mediaType])

const description = ref('')
const isSaving = ref(false)
const didSave = ref(false)

/** One attachment manager per media table, picked reactively by media type. */
const rowId = toRef(props, 'entityId')
const INLINE_ATTACHMENTS: Record<MediaType, ReturnType<typeof useInlineAttachments>> = {
  game: useInlineAttachments({ table: games, rowId, field: 'descriptionInlineFiles' }),
  anime: useInlineAttachments({ table: animes, rowId, field: 'descriptionInlineFiles' }),
  comic: useInlineAttachments({ table: comics, rowId, field: 'descriptionInlineFiles' }),
  novel: useInlineAttachments({ table: novels, rowId, field: 'descriptionInlineFiles' })
}

const attachments = computed(() => INLINE_ATTACHMENTS[props.mediaType])

const { data: row, isLoading } = useLiveQuery(
  async () => {
    const rows = await db
      .select({ description: table.value.description })
      .from(table.value)
      .where(eq(table.value.id, props.entityId))
      .limit(1)
    return rows[0]
  },
  {
    watch: [() => props.entityId],
    enabled: () => open.value
  }
)

watch(row, (data) => {
  if (data) {
    description.value = data.description || ''
    attachments.value.setBaselineContent(description.value)
  }
})

watch(open, async (isOpen, wasOpen) => {
  if (isOpen) {
    didSave.value = false
    return
  }
  if (wasOpen && !didSave.value) {
    try {
      await attachments.value.gcOnCancel()
    } catch (error) {
      log.warn('Inline attachment cleanup failed:', error)
    }
  }
})

async function handleSubmit() {
  isSaving.value = true
  try {
    const next = description.value.trim()
    await updateEntityRows(props.mediaType, [props.entityId], { description: next || null })

    await attachments.value.gcOnSave(next)
    didSave.value = true
    notify.success(m.value.feedback.saved)
    open.value = false
  } catch (error) {
    log.error('Update failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="2xl">
      <!-- Loading state -->
      <template v-if="isLoading || !row">
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
                    v-model="description"
                    :placeholder="
                      m.library.forms.descriptionPlaceholder({
                        label: m.library.entities[props.mediaType]
                      })
                    "
                    min-height="36rem"
                    max-height="36rem"
                    :on-attachment="attachments.onAttachment"
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
              @click="open = false"
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
