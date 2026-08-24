<!--
  MediaDurationSessionFormDialog
  Dialog for adding/editing a media session with start and end times.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { formatDatetimeLocalInput } from '@renderer/utils/datetime'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Field, FieldGroup, FieldLabel, FieldContent } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { notify } from '@renderer/core/notify'
import type { MediaType } from '@shared/common'
import { useI18n } from '@renderer/composables/use-i18n'
import type { MediaSessionRow } from '../media-tables'

const { m } = useI18n()

interface SessionData {
  startedAt: Date
  endedAt: Date
}

interface Props {
  mediaType: MediaType
  /** Existing session for editing, undefined for add mode */
  initialData?: SessionData
  /** Existing sessions for overlap validation */
  existingSessions: MediaSessionRow[]
  /** ID of editing session to exclude from overlap check */
  editingId?: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: SessionData]
}>()

const labels = computed(() => m.value[props.mediaType].duration)

interface FormData {
  startedAt: string
  endedAt: string
}

const formData = ref<FormData>({
  startedAt: '',
  endedAt: ''
})

const isAddMode = computed(() => !props.initialData)

// Initialize form state when dialog opens
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      if (props.initialData) {
        formData.value.startedAt = formatDatetimeLocalInput(props.initialData.startedAt)
        formData.value.endedAt = formatDatetimeLocalInput(props.initialData.endedAt)
      } else {
        const now = new Date()
        const oneHourAgo = new Date(now.getTime() - 3600000)
        formData.value.startedAt = formatDatetimeLocalInput(oneHourAgo)
        formData.value.endedAt = formatDatetimeLocalInput(now)
      }
    }
  },
  { immediate: true }
)

function findOverlappingSession(startedAt: Date, endedAt: Date): boolean {
  for (const session of props.existingSessions) {
    if (session.id === props.editingId) continue
    if (startedAt < session.endedAt && session.startedAt < endedAt) {
      return true
    }
  }
  return false
}

function handleSubmit() {
  if (!formData.value.startedAt || !formData.value.endedAt) {
    notify.error(labels.value.startEndRequired)
    return
  }
  const start = new Date(formData.value.startedAt)
  const end = new Date(formData.value.endedAt)
  if (start >= end) {
    notify.error(labels.value.endAfterStart)
    return
  }
  if (findOverlappingSession(start, end)) {
    notify.error(labels.value.overlap)
    return
  }

  emit('submit', { startedAt: start, endedAt: end })
  open.value = false
}

function handleCancel() {
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ isAddMode ? labels.addRecord : labels.editRecord }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{{ labels.startTime }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.startedAt"
                  type="datetime-local"
                  required
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ labels.endTime }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.endedAt"
                  type="datetime-local"
                  required
                />
              </FieldContent>
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="handleCancel"
          >
            {{ m.common.cancel }}
          </Button>
          <Button type="submit">{{ m.common.confirm }}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
