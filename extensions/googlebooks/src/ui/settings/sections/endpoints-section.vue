<!-- Endpoints Section edits the OAuth relay root. -->
<script setup lang="ts">
import { Button, Field, FieldGroup, Icon, Input, SettingsSection } from '@kisaki3/extension-ui-vue'
import { GBOOKS_DEFAULT_OAUTH_RELAY_URL } from '../../../shared/settings'
import { settingsForm } from '../form'
import { m } from '../i18n'

const isDefault = (): boolean => settingsForm.oauthRelayUrl === GBOOKS_DEFAULT_OAUTH_RELAY_URL

function restoreDefaults(): void {
  settingsForm.oauthRelayUrl = GBOOKS_DEFAULT_OAUTH_RELAY_URL
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
        :label="m.ui.endpoints.relayUrlLabel"
        :description="m.ui.endpoints.relayUrlDescription"
      >
        <Input
          v-model="settingsForm.oauthRelayUrl"
          type="url"
          autocomplete="off"
          spellcheck="false"
          :placeholder="GBOOKS_DEFAULT_OAUTH_RELAY_URL"
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
