<!--
Account Section owns the Web API key and the SteamID64, plus verification
that both work by counting the visible owned games.
-->
<script setup lang="ts">
import { ref } from 'vue'
import {
  Badge,
  Button,
  Field,
  FieldContent,
  FieldGroup,
  Icon,
  Input,
  SettingsSection,
  Spinner
} from '@kisaki3/extension-ui-vue'
import {
  STEAM_API_KEY_PAGE_URL,
  matchesSteamId64Format,
  type SteamAccountState,
  type SteamAccountVerification
} from '../../../shared/settings'
import { settingsForm } from '../form'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'

interface Props {
  account: SteamAccountState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const keyInput = ref('')
const verification = ref<SteamAccountVerification | null>(null)
const busyAction = ref<string | null>(null)

async function runAction(action: string, run: () => Promise<void>): Promise<void> {
  if (busyAction.value) {
    return
  }

  busyAction.value = action
  try {
    await run()
    emit('refresh')
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    busyAction.value = null
  }
}

function saveKey(): void {
  void runAction('save', async () => {
    await host.saveApiKey(keyInput.value)
    keyInput.value = ''
  })
}

function clearKey(): void {
  verification.value = null
  void runAction('clear', async () => {
    await host.clearApiKey()
  })
}

function verifyAccount(): void {
  void runAction('verify', async () => {
    verification.value = await host.verifyAccount()
  })
}

function openKeyPage(): void {
  void host.openExternal(STEAM_API_KEY_PAGE_URL).catch((error) => {
    emit('error', toErrorMessage(error))
  })
}
</script>

<template>
  <SettingsSection
    :title="m.ui.account.title"
    :description="m.ui.account.description"
    surface="rows"
  >
    <FieldGroup>
      <Field
        orientation="horizontal"
        :label="m.ui.account.statusLabel"
      >
        <FieldContent class="flex-row items-center justify-end gap-2">
          <span
            v-if="verification"
            class="text-xs text-muted-foreground"
          >
            {{ m.ui.account.verifiedGames({ count: verification.gameCount }) }}
          </span>
          <Badge :variant="props.account.keyConfigured ? 'success' : 'secondary'">
            {{
              props.account.keyConfigured ? m.ui.account.configuredLabel : m.ui.account.missingLabel
            }}
          </Badge>
        </FieldContent>
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.account.keyLabel"
      >
        <FieldContent class="flex-row items-center gap-2">
          <Input
            v-model="keyInput"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :placeholder="m.ui.account.keyPlaceholder"
            class="w-72"
          />
          <Button
            size="sm"
            type="button"
            :disabled="!keyInput.trim() || busyAction !== null"
            @click="saveKey"
          >
            <Spinner v-if="busyAction === 'save'" />
            {{ m.ui.account.saveKey }}
          </Button>
        </FieldContent>
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.account.steamIdLabel"
        :description="m.ui.account.steamIdDescription"
      >
        <FieldContent class="flex-row items-center justify-end gap-2">
          <Input
            v-model="settingsForm.steamId"
            autocomplete="off"
            spellcheck="false"
            class="w-56"
          />
          <Badge
            v-if="settingsForm.steamId && !matchesSteamId64Format(settingsForm.steamId)"
            variant="destructive"
          >
            {{ m.errors.steamIdInvalid }}
          </Badge>
        </FieldContent>
      </Field>
    </FieldGroup>

    <template #actions>
      <Button
        variant="outline"
        size="sm"
        type="button"
        @click="openKeyPage"
      >
        <Icon
          icon="icon-[mdi--open-in-new]"
          class="size-3.5"
        />
        {{ m.ui.account.openKeyPage }}
      </Button>
      <Button
        v-if="props.account.keyConfigured"
        variant="outline"
        size="sm"
        type="button"
        :disabled="busyAction !== null"
        @click="verifyAccount"
      >
        <Spinner v-if="busyAction === 'verify'" />
        <Icon
          v-else
          icon="icon-[mdi--account-check]"
          class="size-3.5"
        />
        {{ m.ui.account.verify }}
      </Button>
      <Button
        v-if="props.account.keyConfigured"
        variant="destructive"
        size="sm"
        type="button"
        :disabled="busyAction !== null"
        @click="clearKey"
      >
        <Spinner v-if="busyAction === 'clear'" />
        <Icon
          v-else
          icon="icon-[mdi--key-remove]"
          class="size-3.5"
        />
        {{ m.ui.account.clearKey }}
      </Button>
    </template>
  </SettingsSection>
</template>
