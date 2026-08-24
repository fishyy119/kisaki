<!-- Maintenance Tab edits advanced client preferences and destructive local maintenance. -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Field,
  FieldContent,
  FieldGroup,
  Icon,
  Input,
  SettingsSection,
  Switch
} from '@kisaki3/extension-ui-vue'
import { settingsForm } from '../form'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

interface DangerAction {
  title: string
  description: string
  run: () => Promise<void>
}

const dangerActions = computed<readonly { key: string; label: string; action: DangerAction }[]>(
  () => [
    {
      key: 'clear-sync',
      label: m.value.ui.maintenance.clearSyncState,
      action: {
        title: m.value.ui.maintenance.clearSyncState,
        description: m.value.ui.maintenance.clearSyncStateDescription,
        run: () => host.clearSyncState()
      }
    },
    {
      key: 'reset',
      label: m.value.ui.maintenance.resetSettings,
      action: {
        title: m.value.ui.maintenance.resetSettings,
        description: m.value.ui.maintenance.resetSettingsDescription,
        run: () => host.resetSettings()
      }
    }
  ]
)

const busy = ref(false)
const confirmOpen = ref(false)
const pendingAction = ref<DangerAction | null>(null)

function requestAction(action: DangerAction): void {
  pendingAction.value = action
  confirmOpen.value = true
}

async function confirmAction(): Promise<void> {
  const action = pendingAction.value
  if (!action || busy.value) {
    return
  }

  busy.value = true
  try {
    await action.run()
    confirmOpen.value = false
    emit('refresh')
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <SettingsSection
      :title="m.ui.maintenance.networkTitle"
      :description="m.ui.maintenance.networkDescription"
      surface="rows"
    >
      <FieldGroup>
        <Field
          orientation="horizontal"
          :label="m.ui.maintenance.loginTimeout"
        >
          <FieldContent class="flex-row items-center gap-2">
            <Input
              v-model.number="settingsForm.loginTimeoutMinutes"
              type="number"
              min="1"
              max="60"
              class="w-20"
            />
            <span class="text-xs text-muted-foreground">{{ m.ui.maintenance.minutes }}</span>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          :label="m.ui.maintenance.rateLimit"
          :description="m.ui.maintenance.rateLimitDescription"
        >
          <FieldContent class="flex-row items-center gap-2">
            <Input
              v-model.number="settingsForm.rateLimitMaxRequests"
              type="number"
              min="1"
              max="10000"
              class="w-20"
            />
            <span class="text-xs text-muted-foreground">/</span>
            <Input
              v-model.number="settingsForm.rateLimitWindowSeconds"
              type="number"
              min="1"
              max="3600"
              class="w-20"
            />
            <span class="text-xs text-muted-foreground">{{ m.ui.maintenance.seconds }}</span>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          :label="m.ui.maintenance.apiTimeout"
        >
          <FieldContent class="flex-row items-center gap-2">
            <Input
              v-model.number="settingsForm.timeoutSeconds"
              type="number"
              min="1"
              max="120"
              class="w-20"
            />
            <span class="text-xs text-muted-foreground">{{ m.ui.maintenance.seconds }}</span>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          :label="m.ui.maintenance.retryCount"
        >
          <FieldContent class="flex-row items-center gap-2">
            <Input
              v-model.number="settingsForm.retryCount"
              type="number"
              min="0"
              max="10"
              class="w-20"
            />
            <span class="text-xs text-muted-foreground">{{ m.ui.maintenance.retryUnit }}</span>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          :label="m.ui.maintenance.debounce"
        >
          <FieldContent class="flex-row items-center gap-2">
            <Input
              v-model.number="settingsForm.debounceSeconds"
              type="number"
              min="0.25"
              max="60"
              step="0.25"
              class="w-20"
            />
            <span class="text-xs text-muted-foreground">{{ m.ui.maintenance.seconds }}</span>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          :label="m.ui.maintenance.notifyErrors"
          :description="m.ui.maintenance.notifyErrorsDescription"
        >
          <Switch v-model="settingsForm.notifyErrors" />
        </Field>
      </FieldGroup>
    </SettingsSection>

    <SettingsSection
      :title="m.ui.maintenance.actionsTitle"
      :description="m.ui.maintenance.actionsDescription"
    >
      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-for="entry in dangerActions"
          :key="entry.key"
          variant="destructive"
          size="sm"
          type="button"
          :disabled="busy"
          @click="requestAction(entry.action)"
        >
          <Icon
            icon="icon-[mdi--alert-outline]"
            class="size-3.5"
          />
          {{ entry.label }}
        </Button>
      </div>
    </SettingsSection>

    <AlertDialog v-model:open="confirmOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ pendingAction?.title }}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          {{ pendingAction?.description }}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="busy">{{ m.common.cancel }}</AlertDialogCancel>
          <AlertDialogAction
            :disabled="busy"
            @click="confirmAction"
          >
            {{ m.ui.maintenance.confirmAction }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
