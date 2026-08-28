<!-- Endpoints Section edits the GraphQL and OAuth relay roots for mirror setups. -->
<script setup lang="ts">
import { Button, Field, FieldGroup, Icon, Input, SettingsSection } from '@kisaki3/extension-ui-vue'
import {
  ANILIST_DEFAULT_GRAPHQL_URL,
  ANILIST_DEFAULT_OAUTH_RELAY_URL
} from '../../../shared/settings'
import { settingsForm } from '../form'
import { m } from '../i18n'

const isDefault = (): boolean =>
  settingsForm.graphqlUrl === ANILIST_DEFAULT_GRAPHQL_URL &&
  settingsForm.oauthRelayUrl === ANILIST_DEFAULT_OAUTH_RELAY_URL

function restoreDefaults(): void {
  settingsForm.graphqlUrl = ANILIST_DEFAULT_GRAPHQL_URL
  settingsForm.oauthRelayUrl = ANILIST_DEFAULT_OAUTH_RELAY_URL
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
        :label="m.ui.endpoints.graphqlUrlLabel"
        :description="m.ui.endpoints.graphqlUrlDescription"
      >
        <Input
          v-model="settingsForm.graphqlUrl"
          type="url"
          autocomplete="off"
          spellcheck="false"
          :placeholder="ANILIST_DEFAULT_GRAPHQL_URL"
          class="w-80"
        />
      </Field>

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
          :placeholder="ANILIST_DEFAULT_OAUTH_RELAY_URL"
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
