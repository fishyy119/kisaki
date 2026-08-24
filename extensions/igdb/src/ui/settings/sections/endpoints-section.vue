<!-- Endpoints Section edits the API and OAuth hosts, for mirrors. -->
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
import {
  IGDB_DEFAULT_API_BASE_URL,
  IGDB_DEFAULT_OAUTH_URL,
  matchesHttpUrlFormat
} from '../../../shared/settings'
import { settingsForm } from '../form'
import { m } from '../i18n'

const isOfficial = computed(
  () =>
    settingsForm.apiBaseUrl === IGDB_DEFAULT_API_BASE_URL &&
    settingsForm.oauthUrl === IGDB_DEFAULT_OAUTH_URL
)
const apiBaseUrlInvalid = computed(() => !matchesHttpUrlFormat(settingsForm.apiBaseUrl))
const oauthUrlInvalid = computed(() => !matchesHttpUrlFormat(settingsForm.oauthUrl))

function restoreDefaults(): void {
  settingsForm.apiBaseUrl = IGDB_DEFAULT_API_BASE_URL
  settingsForm.oauthUrl = IGDB_DEFAULT_OAUTH_URL
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

      <Field
        orientation="horizontal"
        :label="m.ui.endpoints.oauthUrlLabel"
        :description="m.ui.endpoints.oauthUrlDescription"
      >
        <FieldContent class="items-end">
          <Input
            v-model="settingsForm.oauthUrl"
            type="url"
            autocomplete="off"
            spellcheck="false"
            :aria-invalid="oauthUrlInvalid"
            class="w-72"
          />
          <FieldError v-if="oauthUrlInvalid">{{ m.errors.baseUrlInvalid }}</FieldError>
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
