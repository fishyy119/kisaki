<!-- Maintenance Tab edits the endpoint, client preferences, and destructive resets. -->
<script setup lang="ts">
import { ref } from 'vue'
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
import { VNDB_DEFAULT_API_BASE_URL } from '../../../shared/settings'
import { settingsForm } from '../form'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const resetOpen = ref(false)
const resetting = ref(false)

const isDefaultEndpoint = (): boolean => settingsForm.apiBaseUrl === VNDB_DEFAULT_API_BASE_URL

function restoreEndpoint(): void {
  settingsForm.apiBaseUrl = VNDB_DEFAULT_API_BASE_URL
}

async function confirmReset(): Promise<void> {
  if (resetting.value) {
    return
  }

  resetting.value = true
  try {
    await host.resetSettings()
    resetOpen.value = false
    emit('refresh')
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <SettingsSection
      :title="m.ui.maintenance.endpointTitle"
      :description="m.ui.maintenance.endpointDescription"
      surface="rows"
    >
      <FieldGroup>
        <Field
          orientation="horizontal"
          :label="m.ui.maintenance.apiBaseUrlLabel"
          :description="m.ui.maintenance.apiBaseUrlDescription"
        >
          <Input
            v-model="settingsForm.apiBaseUrl"
            type="url"
            autocomplete="off"
            spellcheck="false"
            :placeholder="VNDB_DEFAULT_API_BASE_URL"
            class="w-80"
          />
        </Field>
      </FieldGroup>

      <template #actions>
        <Button
          variant="outline"
          size="sm"
          type="button"
          :disabled="isDefaultEndpoint()"
          @click="restoreEndpoint"
        >
          <Icon
            icon="icon-[mdi--backup-restore]"
            class="size-3.5"
          />
          {{ m.ui.maintenance.restoreDefaults }}
        </Button>
      </template>
    </SettingsSection>

    <SettingsSection
      :title="m.ui.maintenance.clientTitle"
      :description="m.ui.maintenance.clientDescription"
      surface="rows"
    >
      <FieldGroup>
        <Field
          orientation="horizontal"
          :label="m.ui.maintenance.preferRomanizedLabel"
          :description="m.ui.maintenance.preferRomanizedDescription"
        >
          <Switch v-model="settingsForm.preferRomanizedTitles" />
        </Field>

        <Field
          orientation="horizontal"
          :label="m.ui.maintenance.timeoutLabel"
          :description="m.ui.maintenance.timeoutDescription"
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
          :label="m.ui.maintenance.retryLabel"
          :description="m.ui.maintenance.retryDescription"
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
      </FieldGroup>
    </SettingsSection>

    <SettingsSection
      :title="m.ui.maintenance.actionsTitle"
      :description="m.ui.maintenance.actionsDescription"
    >
      <div class="flex flex-wrap items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          type="button"
          :disabled="resetting"
          @click="resetOpen = true"
        >
          <Icon
            icon="icon-[mdi--backup-restore]"
            class="size-3.5"
          />
          {{ m.ui.maintenance.reset }}
        </Button>
      </div>
    </SettingsSection>

    <AlertDialog v-model:open="resetOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ m.ui.maintenance.reset }}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          {{ m.ui.maintenance.resetDescription }}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="resetting">{{ m.ui.cancel }}</AlertDialogCancel>
          <AlertDialogAction
            :disabled="resetting"
            @click="confirmReset"
          >
            {{ m.ui.confirm }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
