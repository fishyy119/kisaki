<!--
  MediaLastActiveFormDialog
  Dialog for editing a media entry's last active (played/watched) time; media
  differences arrive as the `mediaType` registry key only.
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import type { MediaType } from '@shared/common'
import { useAsyncData } from '@renderer/composables'
import { formatDatetimeLocalInput } from '@renderer/utils/datetime'
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
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldGroup,
  FieldDescription
} from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { notify } from '@renderer/core/notify'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'
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
const labels = computed(() => m.value[props.mediaType].lastActiveDialog)

const datetime = ref('')
const isSaving = ref(false)

const { data: row, isLoading } = useAsyncData(
  async () => {
    const rows = await db
      .select({ lastActiveAt: table.value.lastActiveAt })
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
    datetime.value = formatDatetimeLocalInput(data.lastActiveAt)
  }
})

async function handleSubmit() {
  isSaving.value = true
  try {
    await db
      .update(table.value)
      .set({ lastActiveAt: datetime.value ? new Date(datetime.value) : null })
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

function clearDatetime() {
  datetime.value = ''
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
          <DialogTitle>{{ labels.title }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel>{{ labels.label }}</FieldLabel>
                <FieldContent>
                  <div class="flex gap-2">
                    <Input
                      v-model="datetime"
                      type="datetime-local"
                      class="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      @click="clearDatetime"
                    >
                      {{ m.common.clear }}
                    </Button>
                  </div>
                </FieldContent>
                <FieldDescription>{{ labels.emptyHint }}</FieldDescription>
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
