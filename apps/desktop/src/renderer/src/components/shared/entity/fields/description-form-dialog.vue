<!--
  EntityDescriptionFormDialog
  Dialog for editing an entity's plain markdown description. Media entries
  with inline attachment support use the media-domain description dialog
  instead.
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { db, ENTITY_TABLES } from '@renderer/core/db'
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
import { Button } from '@renderer/components/ui/button'
import { MarkdownEditor } from '@renderer/components/ui/markdown'
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { notify } from '@renderer/core/notify'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'
import type { ContentEntityType } from '@shared/common'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  entityType: ContentEntityType
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const table = computed(() => ENTITY_TABLES[props.entityType].table)

const description = ref('')
const isSaving = ref(false)

const { data: row, isLoading } = useAsyncData(
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
  }
})

async function handleSubmit() {
  isSaving.value = true
  try {
    await db
      .update(table.value)
      .set({ description: description.value.trim() || null })
      .where(eq(table.value.id, props.entityId))
    notify.success(m.value.common.saved)
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
    <DialogContent class="max-w-6xl">
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
                        label: m.library.entities[props.entityType]
                      })
                    "
                    min-height="500px"
                    max-height="500px"
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
