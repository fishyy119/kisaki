<!-- Sync Tab edits auto push preferences and launches the manual full push. -->
<script setup lang="ts">
import {
  Button,
  Field,
  FieldGroup,
  Icon,
  SettingsSection,
  Spinner,
  Switch
} from '@kisaki3/extension-ui-vue'
import { settingsForm } from '../form'
import { m } from '../i18n'
import { host } from '../rpc'
import { useTaskRun } from '../use-task-run'
import TaskRunLine from '../components/task-run-line.vue'

const emit = defineEmits<{
  error: [message: string]
}>()

const push = useTaskRun((message) => emit('error', message))

function startPushAll(): void {
  push.start(() => host.startPushAll())
}
</script>

<template>
  <div class="space-y-4">
    <SettingsSection
      :title="m.ui.sync.preferencesTitle"
      surface="rows"
    >
      <FieldGroup>
        <Field
          orientation="horizontal"
          :label="m.ui.sync.syncEnabledLabel"
          :description="m.ui.sync.syncEnabledDescription"
        >
          <Switch v-model="settingsForm.syncEnabled" />
        </Field>

        <Field
          orientation="horizontal"
          :label="m.ui.sync.pushScoreLabel"
          :description="m.ui.sync.pushScoreDescription"
        >
          <Switch v-model="settingsForm.syncPushScore" />
        </Field>
      </FieldGroup>
    </SettingsSection>

    <SettingsSection
      :title="m.ui.sync.manualTitle"
      :description="m.ui.sync.manualDescription"
    >
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            :disabled="push.starting.value || push.active.value"
            @click="startPushAll"
          >
            <Spinner v-if="push.starting.value" />
            <Icon
              v-else
              icon="icon-[mdi--cloud-upload]"
              class="size-3.5"
            />
            {{ m.ui.sync.pushAll }}
          </Button>
        </div>

        <TaskRunLine
          :task="push.task.value"
          :active="push.active.value"
          :percent="push.percent.value"
          :status-label="push.statusLabel.value"
          @cancel="push.cancel()"
        />
      </div>
    </SettingsSection>
  </div>
</template>
