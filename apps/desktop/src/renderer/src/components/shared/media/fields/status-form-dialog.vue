<!--
  MediaStatusFormDialog
  Dialog for editing a media entry's consumption status. The status vocabulary
  is shared by every media type; only the display verbs differ per media. The
  saved status is emitted so media-specific hosts can offer their own
  follow-up; this dialog stays unaware of what a status implies.
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import type { MediaType } from '@shared/entity-types'
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
import { Button } from '@renderer/components/ui/button'
import { Field, FieldGroup, FieldLabel, FieldContent } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { notify } from '@renderer/core/notify'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'
import { MEDIA_STATUS_VALUES, type MediaStatus } from '@shared/db'
import { MEDIA_STATUS_WRITERS, MEDIA_TABLES } from '../media-tables'

const { m } = useI18n()

const log = createLogger('Library')

interface Props {
  mediaType: MediaType
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  /** Fires only when the write succeeded, carrying the stored status value. */
  saved: [status: MediaStatus]
}>()

const table = computed(() => MEDIA_TABLES[props.mediaType])

const options = computed(() =>
  MEDIA_STATUS_VALUES.map((value) => ({
    value,
    label: m.value.library.status.values[props.mediaType][value]
  }))
)

const status = ref<MediaStatus>('planned')
const isSaving = ref(false)

const { data: row, isLoading } = useLiveQuery(
  async () => {
    const rows = await db
      .select({ status: table.value.status })
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
    status.value = data.status
  }
})

async function handleSubmit() {
  isSaving.value = true
  try {
    await MEDIA_STATUS_WRITERS[props.mediaType](props.entityId, status.value)
    notify.success(m.value.feedback.saved)
    open.value = false
    emit('saved', status.value)
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
          <DialogTitle>{{ m.library.status.editTitle[mediaType] }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{{ m.library.status.label[mediaType] }}</FieldLabel>
                <FieldContent>
                  <Select v-model="status">
                    <SelectTrigger>
                      <SelectValue :placeholder="m.library.status.selectPlaceholder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="option in options"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
