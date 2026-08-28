<!-- Endpoints Section edits the NeoDB instance root. -->
<script setup lang="ts">
import { Button, Field, FieldGroup, Icon, Input, SettingsSection } from '@kisaki3/extension-ui-vue'
import { NEODB_DEFAULT_INSTANCE_URL } from '../../../shared/settings'
import { settingsForm } from '../form'
import { m } from '../i18n'

const isDefault = (): boolean => settingsForm.instanceUrl === NEODB_DEFAULT_INSTANCE_URL

function restoreDefaults(): void {
  settingsForm.instanceUrl = NEODB_DEFAULT_INSTANCE_URL
}
</script>

<template>
  <SettingsSection
    :title="m.ui.endpoints.title"
    :description="m.ui.endpoints.description"
    surface="rows"
  >
    <FieldGroup>
      <Field
        orientation="horizontal"
        :label="m.ui.endpoints.instanceUrlLabel"
        :description="m.ui.endpoints.instanceUrlDescription"
      >
        <Input
          v-model="settingsForm.instanceUrl"
          type="url"
          autocomplete="off"
          spellcheck="false"
          :placeholder="NEODB_DEFAULT_INSTANCE_URL"
          class="w-80"
        />
      </Field>
    </FieldGroup>

    <template #actions>
      <Button
        variant="outline"
        size="sm"
        type="button"
        :disabled="isDefault()"
        @click="restoreDefaults"
      >
        <Icon
          icon="icon-[mdi--backup-restore]"
          class="size-3.5"
        />
        {{ m.ui.endpoints.restoreDefaults }}
      </Button>
    </template>
  </SettingsSection>
</template>
