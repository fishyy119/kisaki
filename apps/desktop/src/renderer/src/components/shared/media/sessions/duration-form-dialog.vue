<!--
  MediaDurationFormDialog
  Dialog for editing a media entry's total time and session records; media
  differences arrive as the `mediaType` registry key only.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { db, updateEntityRows } from '@renderer/core/db'
import type { MediaType } from '@shared/entity-types'
import { useLiveQuery } from '@renderer/composables'
import { useI18n } from '@renderer/composables/use-i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Field, FieldLabel, FieldContent, FieldDescription } from '@renderer/components/ui/field'
import { ListItem, ListItemActions } from '@renderer/components/ui/list-item'
import { notify } from '@renderer/core/notify'
import { createLogger } from '@renderer/core/log'
import { MEDIA_SESSION_STORES, MEDIA_TABLES, type MediaSessionRow } from '../media-tables'
import MediaDurationSessionFormDialog from './duration-session-form-dialog.vue'

const log = createLogger('Library')

interface Props {
  mediaType: MediaType
  entityId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m, f } = useI18n()

const table = computed(() => MEDIA_TABLES[props.mediaType])
const store = computed(() => MEDIA_SESSION_STORES[props.mediaType])
const labels = computed(() => m.value[props.mediaType].duration)

function calculateSessionsDuration(sessionsList: MediaSessionRow[]): number {
  return sessionsList.reduce((sum, session) => {
    const duration = session.endedAt.getTime() - session.startedAt.getTime()
    return sum + Math.max(0, duration)
  }, 0)
}

function parseDurationToMs(hours: number, minutes: number): number {
  return (hours * 3600 + minutes * 60) * 1000
}

function msToHoursMinutes(ms: number): { hours: number; minutes: number } {
  const seconds = Math.floor(ms / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return { hours, minutes }
}

// Form state
const sessions = ref<MediaSessionRow[]>([])
const untrackedHours = ref(0)
const untrackedMinutes = ref(0)
const deleteId = ref<string | null>(null)
const sessionFormOpen = ref(false)
const editingId = ref<string | null>(null)
const isSaving = ref(false)

interface InitialDurationData {
  sessions: MediaSessionRow[]
  untrackedHours: number
  untrackedMinutes: number
}

const { data, isLoading } = useLiveQuery<InitialDurationData>(
  async () => {
    const [sessionsData, rows] = await Promise.all([
      store.value.list(props.entityId),
      db
        .select({ totalDuration: table.value.totalDuration })
        .from(table.value)
        .where(eq(table.value.id, props.entityId))
        .limit(1)
    ])
    let hours = 0
    let minutes = 0
    const row = rows[0]
    if (row) {
      const sessionsDurationMs = calculateSessionsDuration(sessionsData)
      const untracked = Math.max(0, row.totalDuration - sessionsDurationMs)
      const result = msToHoursMinutes(untracked)
      hours = result.hours
      minutes = result.minutes
    }
    return { sessions: sessionsData, untrackedHours: hours, untrackedMinutes: minutes }
  },
  {
    watch: [() => props.entityId],
    enabled: () => open.value
  }
)

// Initialize form state when data loads
watch(data, (d) => {
  if (d) {
    sessions.value = d.sessions
    untrackedHours.value = d.untrackedHours
    untrackedMinutes.value = d.untrackedMinutes
  }
})

const sessionsDuration = computed(() => calculateSessionsDuration(sessions.value))
const untrackedMs = computed(() => parseDurationToMs(untrackedHours.value, untrackedMinutes.value))
const totalDuration = computed(() => sessionsDuration.value + untrackedMs.value)

const deleteDialogOpen = computed({
  get: () => deleteId.value !== null,
  set: (v) => {
    if (!v) deleteId.value = null
  }
})

const sessionFormInitialData = computed(() => {
  if (!editingId.value) return undefined
  const session = sessions.value.find((s) => s.id === editingId.value)
  if (!session) return undefined
  return { startedAt: session.startedAt, endedAt: session.endedAt }
})

async function handleSave() {
  isSaving.value = true
  try {
    const newTotalDuration = sessionsDuration.value + untrackedMs.value
    await updateEntityRows(props.mediaType, [props.entityId], { totalDuration: newTotalDuration })
    notify.success(m.value.feedback.saved)
    open.value = false
  } catch (error) {
    log.error('Update failed:', error)
    notify.error(m.value.library.feedback.saveFailedRetry)
  } finally {
    isSaving.value = false
  }
}

async function handleDeleteSession(sessionId: string) {
  try {
    await store.value.remove(sessionId)
    sessions.value = sessions.value.filter((s) => s.id !== sessionId)
    notify.success(labels.value.recordDeleted)
  } catch (error) {
    log.error('Delete session failed:', error)
    notify.error(m.value.feedback.deleteFailed)
  } finally {
    deleteId.value = null
  }
}

function handleAddClick() {
  editingId.value = null
  sessionFormOpen.value = true
}

function handleEditClick(sessionId: string) {
  editingId.value = sessionId
  sessionFormOpen.value = true
}

async function handleSessionFormSubmit(data: { startedAt: Date; endedAt: Date }) {
  try {
    if (editingId.value) {
      await store.value.update(editingId.value, data)
      notify.success(labels.value.recordUpdated)
    } else {
      await store.value.insert(props.entityId, data)
      notify.success(labels.value.recordAdded)
    }
    sessions.value = await store.value.list(props.entityId)
  } catch (error) {
    log.error('Session save failed:', error)
    notify.error(
      editingId.value ? m.value.library.feedback.updateFailed : m.value.library.feedback.addFailed
    )
  }
  sessionFormOpen.value = false
  editingId.value = null
}

function handleCancel() {
  open.value = false
}

// Computed model for hours input (parse and clamp >= 0)
const hoursModel = computed({
  get: () => String(untrackedHours.value),
  set: (v: string) => {
    untrackedHours.value = Math.max(0, parseInt(v, 10) || 0)
  }
})

// Computed model for minutes input (parse and clamp 0-59)
const minutesModel = computed({
  get: () => String(untrackedMinutes.value),
  set: (v: string) => {
    untrackedMinutes.value = Math.max(0, Math.min(59, parseInt(v, 10) || 0))
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="md">
      <!-- Loading state -->
      <template v-if="isLoading || !data">
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
        <!-- Total duration summary -->
        <div class="px-4 py-3 border-b bg-muted/30">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">{{ labels.totalTime }}</span>
            <span class="font-medium">{{ f.duration(totalDuration) }}</span>
          </div>
          <div class="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>{{ labels.sessionsDuration({ value: f.duration(sessionsDuration) }) }}</span>
            <span>{{ labels.untrackedDuration({ value: f.duration(untrackedMs) }) }}</span>
          </div>
        </div>

        <!-- Untracked time input -->
        <div class="px-4 py-3 border-b">
          <Field>
            <FieldLabel>{{ labels.untrackedLabel }}</FieldLabel>
            <FieldContent>
              <div class="flex items-center gap-2">
                <Input
                  v-model="hoursModel"
                  type="number"
                  min="0"
                  class="w-20"
                />
                <span class="text-sm text-muted-foreground">{{ labels.hoursUnit }}</span>
                <Input
                  v-model="minutesModel"
                  type="number"
                  min="0"
                  max="59"
                  class="w-20"
                />
                <span class="text-sm text-muted-foreground">{{ labels.minutesUnit }}</span>
              </div>
            </FieldContent>
            <FieldDescription>{{ labels.untrackedHint }}</FieldDescription>
          </Field>
        </div>

        <!-- Session records: the header stays, the list is the dialog's scroll region -->
        <div class="px-4 py-2 text-sm font-medium text-muted-foreground border-b">
          {{ labels.sessionsHeader({ count: sessions.length }) }}
        </div>
        <DialogBody class="space-y-1">
          <StateView
            v-if="sessions.length === 0"
            state="empty"
            :description="labels.emptySessions"
            class="py-6"
          />
          <ListItem
            v-for="session in sessions"
            v-else
            :key="session.id"
            icon="icon-[mdi--timer-outline]"
            :title="f.duration(session.endedAt.getTime() - session.startedAt.getTime())"
            :description="f.dateTimeRange(session.startedAt, session.endedAt)"
          >
            <template #actions>
              <ListItemActions
                @edit="handleEditClick(session.id)"
                @delete="deleteId = session.id"
              />
            </template>
          </ListItem>
        </DialogBody>
        <DialogFooter class="flex justify-between">
          <Button
            variant="outline"
            @click="handleAddClick"
          >
            <Icon
              icon="icon-[mdi--plus]"
              class="size-4 mr-1.5"
            />
            {{ labels.addRecord }}
          </Button>
          <div class="flex gap-2">
            <Button
              variant="outline"
              @click="handleCancel"
            >
              {{ m.actions.cancel }}
            </Button>
            <Button
              :disabled="isSaving"
              @click="handleSave"
            >
              {{ m.actions.save }}
            </Button>
          </div>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>

  <!-- Session form dialog -->
  <MediaDurationSessionFormDialog
    v-if="sessionFormOpen"
    v-model:open="sessionFormOpen"
    :media-type="props.mediaType"
    :initial-data="sessionFormInitialData"
    :existing-sessions="sessions"
    :editing-id="editingId ?? undefined"
    @submit="handleSessionFormSubmit"
  />

  <!-- Delete confirmation dialog -->
  <AlertDialog v-model:open="deleteDialogOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ m.library.forms.deleteLinkConfirmTitle }}</AlertDialogTitle>
      </AlertDialogHeader>
      <AlertDialogDescription>{{ labels.deleteRecordDescription }}</AlertDialogDescription>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ m.actions.cancel }}</AlertDialogCancel>
        <AlertDialogAction @click="deleteId && handleDeleteSession(deleteId)">
          {{ m.actions.delete }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
