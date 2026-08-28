<!-- Endpoints Section edits the official API root and the metadata mirror. -->
<script setup lang="ts">
import {
  Button,
  Field,
  FieldGroup,
  Icon,
  Input,
  SettingsSection,
  Switch
} from '@kisaki3/extension-ui-vue'
import { MAL_DEFAULT_API_URL, MAL_DEFAULT_MIRROR_URL } from '../../../shared/settings'
import { settingsForm } from '../form'
import { m } from '../i18n'

const isDefault = (): boolean =>
  settingsForm.apiUrl === MAL_DEFAULT_API_URL && settingsForm.mirrorUrl === MAL_DEFAULT_MIRROR_URL

function restoreDefaults(): void {
  settingsForm.apiUrl = MAL_DEFAULT_API_URL
  settingsForm.mirrorUrl = MAL_DEFAULT_MIRROR_URL
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
        :label="m.ui.endpoints.apiUrlLabel"
        :description="m.ui.endpoints.apiUrlDescription"
      >
        <Input
          v-model="settingsForm.apiUrl"
          type="url"
          autocomplete="off"
          spellcheck="false"
          :placeholder="MAL_DEFAULT_API_URL"
          class="w-80"
        />
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.endpoints.mirrorEnabledLabel"
        :description="m.ui.endpoints.mirrorEnabledDescription"
      >
        <Switch v-model="settingsForm.mirrorEnabled" />
      </Field>

      <Field
        v-if="settingsForm.mirrorEnabled"
        orientation="horizontal"
        :label="m.ui.endpoints.mirrorUrlLabel"
        :description="m.ui.endpoints.mirrorUrlDescription"
      >
        <Input
          v-model="settingsForm.mirrorUrl"
          type="url"
          autocomplete="off"
          spellcheck="false"
          :placeholder="MAL_DEFAULT_MIRROR_URL"
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
