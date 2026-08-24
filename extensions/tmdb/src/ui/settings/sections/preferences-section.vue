<!-- Preferences Section edits search and client behaviour, plus a settings reset. -->
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
import { settingsForm } from '../form'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const resetOpen = ref(false)
const resetting = ref(false)

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
  <SettingsSection
    :title="m.ui.preferences.title"
    :description="m.ui.preferences.description"
    surface="rows"
  >
    <FieldGroup>
      <Field
        orientation="horizontal"
        :label="m.ui.preferences.includeAdultLabel"
        :description="m.ui.preferences.includeAdultDescription"
      >
        <Switch v-model="settingsForm.includeAdult" />
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.preferences.timeoutLabel"
        :description="m.ui.preferences.timeoutDescription"
      >
        <FieldContent class="flex-row items-center gap-2">
          <Input
            v-model.number="settingsForm.timeoutSeconds"
            type="number"
            min="1"
            max="120"
            class="w-20"
          />
          <span class="text-xs text-muted-foreground">{{ m.ui.preferences.seconds }}</span>
        </FieldContent>
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.preferences.retryLabel"
        :description="m.ui.preferences.retryDescription"
      >
        <FieldContent class="flex-row items-center gap-2">
          <Input
            v-model.number="settingsForm.retryCount"
            type="number"
            min="0"
            max="10"
            class="w-20"
          />
          <span class="text-xs text-muted-foreground">{{ m.ui.preferences.retryUnit }}</span>
        </FieldContent>
      </Field>
    </FieldGroup>

    <template #actions>
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
        {{ m.ui.preferences.reset }}
      </Button>
    </template>
  </SettingsSection>

  <AlertDialog v-model:open="resetOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ m.ui.preferences.reset }}</AlertDialogTitle>
      </AlertDialogHeader>
      <AlertDialogDescription>
        {{ m.ui.preferences.resetDescription }}
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
</template>
