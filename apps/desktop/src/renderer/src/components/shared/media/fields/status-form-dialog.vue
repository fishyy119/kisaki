<!--
  MediaStatusFormDialog
  Dialog for editing a media entry's consumption status. Each media type keeps
  its own status vocabulary, so options and the write path come from per-media
  registries. The saved status is emitted so media-specific hosts can offer
  their own follow-up; this dialog stays unaware of what a status implies.
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import type { MediaType } from '@shared/common'
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
import { Field, FieldLabel, FieldContent } from '@renderer/components/ui/field'
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
import type { Messages } from '@shared/i18n'
import { ANIME_STATUS_VALUES, GAME_STATUS_VALUES } from '@shared/db'
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
  saved: [status: string]
}>()

const table = computed(() => MEDIA_TABLES[props.mediaType])
const labels = computed(() => m.value[props.mediaType].statusDialog)

const STATUS_OPTIONS: Record<
  MediaType,
  (messages: Messages) => { value: string; label: string }[]
> = {
  game: (messages) =>
    GAME_STATUS_VALUES.map((value) => ({ value, label: messages.library.gameStatus[value] })),
  anime: (messages) =>
    ANIME_STATUS_VALUES.map((value) => ({ value, label: messages.library.animeStatus[value] }))
}

const options = computed(() => STATUS_OPTIONS[props.mediaType](m.value))

const status = ref('')
const isSaving = ref(false)

const { data: row, isLoading } = useAsyncData(
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
    notify.success(m.value.common.saved)
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
          <DialogTitle>{{ labels.title }}</DialogTitle>
        </DialogHeader>
        <Form @submit="handleSubmit">
          <DialogBody>
            <Field>
              <FieldLabel>{{ labels.label }}</FieldLabel>
              <FieldContent>
                <Select v-model="status">
                  <SelectTrigger>
                    <SelectValue :placeholder="labels.selectStatus" />
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
