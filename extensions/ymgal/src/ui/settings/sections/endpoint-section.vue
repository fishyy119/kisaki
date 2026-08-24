<!-- Endpoint Section edits the API root, with a restore for the official host. -->
<script setup lang="ts">
import { computed } from 'vue'
import {
  Button,
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  Icon,
  Input,
  SettingsSection
} from '@kisaki3/extension-ui-vue'
import { matchesHttpUrlFormat, YMGAL_DEFAULT_API_BASE_URL } from '../../../shared/settings'
import { settingsForm } from '../form'
import { m } from '../i18n'

const isOfficial = computed(() => settingsForm.apiBaseUrl === YMGAL_DEFAULT_API_BASE_URL)
const apiBaseUrlInvalid = computed(() => !matchesHttpUrlFormat(settingsForm.apiBaseUrl))

function restoreDefaults(): void {
  settingsForm.apiBaseUrl = YMGAL_DEFAULT_API_BASE_URL
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
        :label="m.ui.endpoints.apiBaseUrlLabel"
        :description="m.ui.endpoints.apiBaseUrlDescription"
      >
        <FieldContent class="items-end">
          <Input
            v-model="settingsForm.apiBaseUrl"
            type="url"
            autocomplete="off"
            spellcheck="false"
            :aria-invalid="apiBaseUrlInvalid"
            class="w-72"
          />
          <FieldError v-if="apiBaseUrlInvalid">{{ m.errors.baseUrlInvalid }}</FieldError>
        </FieldContent>
      </Field>
    </FieldGroup>

    <template #actions>
      <Button
        variant="outline"
        size="sm"
        type="button"
        :disabled="isOfficial"
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
