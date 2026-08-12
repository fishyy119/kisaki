<!--
  AnimeDurationSessionFormDialog
  Dialog for adding/editing an anime watch session with start and end times.
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
import { Field, FieldLabel, FieldContent } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { notify } from '@renderer/core/notify'
import type { AnimeSession } from '@shared/db'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

interface SessionData {
  startedAt: Date
  endedAt: Date
}

interface Props {
  /** Existing session for editing, undefined for add mode */
  initialData?: SessionData
  /** Existing sessions for overlap validation */
  existingSessions: AnimeSession[]
  /** ID of editing session to exclude from overlap check */
  editingId?: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  submit: [data: SessionData]
}>()

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
    notify.error(m.value.anime.duration.startEndRequired)
    return
  }
  const start = new Date(formData.value.startedAt)
  const end = new Date(formData.value.endedAt)
  if (start >= end) {
    notify.error(m.value.anime.duration.endAfterStart)
    return
  }
  if (findOverlappingSession(start, end)) {
    notify.error(m.value.anime.duration.overlap)
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
        <DialogTitle>{{
          isAddMode ? m.anime.duration.addRecord : m.anime.duration.editRecord
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody>
          <div class="space-y-4">
            <Field>
              <FieldLabel>{{ m.anime.duration.startTime }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.startedAt"
                  type="datetime-local"
                  required
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>{{ m.anime.duration.endTime }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.endedAt"
                  type="datetime-local"
                  required
                />
              </FieldContent>
            </Field>
          </div>
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
