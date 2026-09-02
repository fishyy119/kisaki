<!--
  EntityOriginalNameFormDialog
  Dialog for editing an entity's original (native-language) name; entity
  differences arrive as the `entityType` registry key only.
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { db, ENTITY_TABLES, updateEntityRows } from '@renderer/core/db'
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
import { Input } from '@renderer/components/ui/input'
import { Field, FieldGroup, FieldLabel, FieldContent } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { notify } from '@renderer/core/notify'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'
import type { ContentEntityType } from '@shared/entity-types'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  entityType: ContentEntityType
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const table = computed(() => ENTITY_TABLES[props.entityType].table)

const originalName = ref('')
const isSaving = ref(false)

const { data: row, isLoading } = useAsyncData(
  async () => {
    const rows = await db
      .select({ originalName: table.value.originalName })
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
    originalName.value = data.originalName || ''
  }
})

async function handleSubmit() {
  isSaving.value = true
  try {
    await updateEntityRows(props.entityType, [props.entityId], {
      originalName: originalName.value.trim() || null
    })
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
    <DialogContent class="max-w-md">
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
          <DialogTitle>{{ m.library.forms.editOriginalName }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.library.fields.originalName }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="originalName"
                    :placeholder="m.library.forms.originalNamePlaceholder"
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
