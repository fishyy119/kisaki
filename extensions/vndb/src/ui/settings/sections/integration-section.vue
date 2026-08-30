<!--
Integration Section owns the VNDB list connection: account verification,
automatic push preferences, the manual full push, and the list import. Long
operations run as app task runs; this section starts them and polls a small
projection until they settle.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  Badge,
  Button,
  Checkbox,
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
  Spinner,
  Switch
} from '@kisaki3/extension-ui-vue'
import type {
  VndbAccountVerification,
  VndbGameProfileOption,
  VndbTaskStateView
} from '../../../shared/settings'
import { settingsForm } from '../form'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'

const emit = defineEmits<{
  error: [message: string]
}>()

const account = ref<VndbAccountVerification | null>(null)
const verifying = ref(false)

const profiles = ref<VndbGameProfileOption[]>([])
const profileId = ref('')
const updateExisting = ref(true)
const createMissing = ref(false)

const task = ref<VndbTaskStateView | null>(null)
const starting = ref(false)
let pollTimer: ReturnType<typeof setInterval> | undefined

const taskActive = computed(
  () =>
    task.value !== null &&
    ['queued', 'running', 'pausing', 'paused', 'cancelling'].includes(task.value.status)
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
const canImport = computed(
  () => !taskActive.value && (updateExisting.value || (createMissing.value && !!profileId.value))
)

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

async function verifyAccount(): Promise<void> {
  if (verifying.value) {
    return
  }

  verifying.value = true
  try {
    account.value = await host.verifyAccount()
  } catch (error) {
    account.value = null
    emit('error', toErrorMessage(error))
  } finally {
    verifying.value = false
  }
}

function startImport(): void {
  void startTask(() =>
    host.startImport({
      updateExisting: updateExisting.value,
      createMissing: createMissing.value,
      ...(createMissing.value && profileId.value ? { profileId: profileId.value } : {})
    })
  )
}

function startPushAll(): void {
  void startTask(() => host.startPushAll())
}

async function startTask(start: () => Promise<{ runId: string }>): Promise<void> {
  if (starting.value || taskActive.value) {
    return
  }

  starting.value = true
  try {
    const { runId } = await start()
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
        if (
          !state ||
          !['queued', 'running', 'pausing', 'paused', 'cancelling'].includes(state.status)
        ) {
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
        :label="m.ui.integration.permissionsLabel"
      >
        <FieldContent class="flex-row items-center justify-end gap-2">
          <template v-if="account">
            <span class="text-xs text-muted-foreground">
              {{ m.ui.integration.verifiedAs({ username: account.username }) }}
            </span>
            <Badge :variant="account.listRead ? 'success' : 'destructive'">
              {{ m.ui.integration.listRead }}:
              {{
                account.listRead
                  ? m.ui.integration.permissionGranted
                  : m.ui.integration.permissionMissing
              }}
            </Badge>
            <Badge :variant="account.listWrite ? 'success' : 'destructive'">
              {{ m.ui.integration.listWrite }}:
              {{
                account.listWrite
                  ? m.ui.integration.permissionGranted
                  : m.ui.integration.permissionMissing
              }}
            </Badge>
          </template>
          <Button
            variant="outline"
            size="sm"
            type="button"
            :disabled="verifying"
            @click="verifyAccount"
          >
            <Spinner v-if="verifying" />
            <Icon
              v-else
              icon="icon-[mdi--account-check]"
              class="size-3.5"
            />
            {{ m.ui.integration.verify }}
          </Button>
        </FieldContent>
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.integration.syncEnabledLabel"
        :description="m.ui.integration.syncEnabledDescription"
      >
        <Switch v-model="settingsForm.syncEnabled" />
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.integration.pushScoreLabel"
        :description="m.ui.integration.pushScoreDescription"
      >
        <Switch v-model="settingsForm.syncPushScore" />
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.integration.importTitle"
        :description="m.ui.integration.importDescription"
      >
        <FieldContent class="items-end gap-2">
          <div class="flex flex-row items-center gap-3">
            <label class="flex items-center gap-1.5 text-xs">
              <Checkbox v-model="updateExisting" />
              {{ m.ui.integration.updateExistingLabel }}
            </label>
            <label class="flex items-center gap-1.5 text-xs">
              <Checkbox v-model="createMissing" />
              {{ m.ui.integration.createMissingLabel }}
            </label>
            <Select
              v-if="createMissing"
              v-model="profileId"
            >
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
          </div>
        </FieldContent>
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
        variant="outline"
        size="sm"
        type="button"
        :disabled="starting || taskActive"
        @click="startPushAll"
      >
        <Spinner v-if="starting" />
        <Icon
          v-else
          icon="icon-[mdi--cloud-upload]"
          class="size-3.5"
        />
        {{ m.ui.integration.pushAll }}
      </Button>
      <Button
        size="sm"
        type="button"
        :disabled="starting || !canImport"
        @click="startImport"
      >
        <Icon
          icon="icon-[mdi--import]"
          class="size-3.5"
        />
        {{ m.ui.integration.startImport }}
      </Button>
    </template>
  </SettingsSection>
</template>
