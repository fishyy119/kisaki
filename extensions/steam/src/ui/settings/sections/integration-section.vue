<!--
Integration Section owns the owned-games import: profile selection, the start
action, and a small task projection polled until the run settles.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  Button,
  Field,
  FieldContent,
  FieldGroup,
  Icon,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsSection,
  Spinner
} from '@kisaki3/extension-ui-vue'
import type { SteamProfileOption, SteamTaskStateView } from '../../../shared/settings'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'

const emit = defineEmits<{
  error: [message: string]
}>()

const ACTIVE_STATUSES = ['queued', 'running', 'pausing', 'paused', 'cancelling']

const profiles = ref<SteamProfileOption[]>([])
const profileId = ref('')

const task = ref<SteamTaskStateView | null>(null)
const starting = ref(false)
let pollTimer: ReturnType<typeof setInterval> | undefined

const taskActive = computed(
  () => task.value !== null && ACTIVE_STATUSES.includes(task.value.status)
)
const taskPercent = computed<number | null>(() => {
  if (!task.value?.total || task.value.current === undefined) {
    return null
  }
  return Math.round((task.value.current / task.value.total) * 100)
})
const taskStatusLabel = computed(() => {
  switch (task.value?.status) {
    case 'completed':
      return m.value.ui.integration.taskCompleted
    case 'failed':
      return m.value.ui.integration.taskFailed
    case 'cancelled':
      return m.value.ui.integration.taskCancelled
    default:
      return m.value.ui.integration.taskRunning
  }
})
const canImport = computed(() => !taskActive.value && !!profileId.value)

onMounted(() => {
  void loadProfiles()
})

onUnmounted(() => {
  stopPolling()
})

async function loadProfiles(): Promise<void> {
  try {
    profiles.value = await host.listGameProfiles()
    if (!profileId.value && profiles.value.length > 0) {
      profileId.value = profiles.value[0]!.id
    }
  } catch (error) {
    emit('error', toErrorMessage(error))
  }
}

async function startImport(): Promise<void> {
  if (starting.value || taskActive.value || !profileId.value) {
    return
  }

  starting.value = true
  try {
    const { runId } = await host.startImport({ profileId: profileId.value })
    task.value = { runId, status: 'queued' }
    startPolling(runId)
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    starting.value = false
  }
}

function startPolling(runId: string): void {
  stopPolling()
  pollTimer = setInterval(() => {
    void host
      .getTaskState(runId)
      .then((state) => {
        if (state) {
          task.value = state
        }
        if (!state || !ACTIVE_STATUSES.includes(state.status)) {
          stopPolling()
        }
      })
      .catch(() => {
        // Polling is cosmetic; the task run itself reports its outcome.
      })
  }, 1000)
}

function stopPolling(): void {
  if (pollTimer !== undefined) {
    clearInterval(pollTimer)
    pollTimer = undefined
  }
}

function cancelTask(): void {
  const runId = task.value?.runId
  if (!runId) {
    return
  }

  void host.cancelTask(runId).catch((error) => {
    emit('error', toErrorMessage(error))
  })
}
</script>

<template>
  <SettingsSection
    :title="m.ui.integration.title"
    :description="m.ui.integration.description"
    surface="rows"
  >
    <FieldGroup>
      <Field
        orientation="horizontal"
        :label="m.ui.integration.profileLabel"
      >
        <Select v-model="profileId">
          <SelectTrigger
            size="sm"
            class="w-52"
          >
            <SelectValue :placeholder="m.ui.integration.profilePlaceholder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="profile in profiles"
              :key="profile.id"
              :value="profile.id"
            >
              {{ profile.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field
        v-if="task"
        orientation="horizontal"
        :label="taskStatusLabel"
        :description="task.summary ?? task.error"
      >
        <FieldContent class="flex-row items-center justify-end gap-2">
          <template v-if="taskActive">
            <span
              v-if="task.current !== undefined && task.total !== undefined"
              class="text-xs text-muted-foreground"
            >
              {{ m.ui.integration.taskProgress({ current: task.current, total: task.total }) }}
            </span>
            <Progress
              :model-value="taskPercent"
              class="w-40"
            />
            <Button
              variant="outline"
              size="sm"
              type="button"
              @click="cancelTask"
            >
              {{ m.ui.integration.cancelTask }}
            </Button>
          </template>
        </FieldContent>
      </Field>
    </FieldGroup>

    <template #actions>
      <Button
        size="sm"
        type="button"
        :disabled="starting || !canImport"
        @click="startImport"
      >
        <Spinner v-if="starting" />
        <Icon
          v-else
          icon="icon-[mdi--import]"
          class="size-3.5"
        />
        {{ m.ui.integration.startImport }}
      </Button>
    </template>
  </SettingsSection>
</template>
