<!--
Account Section owns the personal-client credential set: entering the four
values, validating them with a sign-in, verifying later, and disconnecting.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
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
import type { MangadexAccountState, MangadexAccountVerification } from '../../../shared/settings'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'

interface Props {
  account: MangadexAccountState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const clientId = ref('')
const clientSecret = ref('')
const username = ref('')
const password = ref('')
const verification = ref<MangadexAccountVerification | null>(null)
const busyAction = ref<string | null>(null)

const canSave = computed(
  () =>
    clientId.value.trim() !== '' &&
    clientSecret.value.trim() !== '' &&
    username.value.trim() !== '' &&
    password.value !== ''
)

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

function saveCredentials(): void {
  void runAction('save', async () => {
    verification.value = await host.saveCredentials({
      clientId: clientId.value,
      clientSecret: clientSecret.value,
      username: username.value,
      password: password.value
    })
    clientId.value = ''
    clientSecret.value = ''
    username.value = ''
    password.value = ''
  })
}

function clearCredentials(): void {
  verification.value = null
  void runAction('clear', async () => {
    await host.clearCredentials()
  })
}

function verifyAccount(): void {
  void runAction('verify', async () => {
    verification.value = await host.verifyAccount()
  })
}

function openClientSettings(): void {
  void host.openExternal('https://mangadex.org/settings').catch((error) => {
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
            {{ m.ui.account.verifiedAs({ userName: verification.userName }) }}
          </span>
          <Badge :variant="props.account.configured ? 'success' : 'secondary'">
            {{
              props.account.configured ? m.ui.account.configuredLabel : m.ui.account.missingLabel
            }}
          </Badge>
        </FieldContent>
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.account.clientIdLabel"
      >
        <Input
          v-model="clientId"
          autocomplete="off"
          spellcheck="false"
          class="w-80"
        />
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.account.clientSecretLabel"
      >
        <Input
          v-model="clientSecret"
          type="password"
          autocomplete="off"
          spellcheck="false"
          class="w-80"
        />
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.account.usernameLabel"
      >
        <Input
          v-model="username"
          autocomplete="off"
          spellcheck="false"
          class="w-80"
        />
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.account.passwordLabel"
      >
        <Input
          v-model="password"
          type="password"
          autocomplete="off"
          spellcheck="false"
          class="w-80"
        />
      </Field>
    </FieldGroup>

    <template #actions>
      <Button
        variant="outline"
        size="sm"
        type="button"
        @click="openClientSettings"
      >
        <Icon
          icon="icon-[mdi--open-in-new]"
          class="size-3.5"
        />
        {{ m.ui.account.openClientSettings }}
      </Button>
      <Button
        size="sm"
        type="button"
        :disabled="!canSave || busyAction !== null"
        @click="saveCredentials"
      >
        <Spinner v-if="busyAction === 'save'" />
        <Icon
          v-else
          icon="icon-[mdi--key-plus]"
          class="size-3.5"
        />
        {{ m.ui.account.save }}
      </Button>
      <Button
        v-if="props.account.configured"
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
        v-if="props.account.configured"
        variant="destructive"
        size="sm"
        type="button"
        :disabled="busyAction !== null"
        @click="clearCredentials"
      >
        <Spinner v-if="busyAction === 'clear'" />
        <Icon
          v-else
          icon="icon-[mdi--key-remove]"
          class="size-3.5"
        />
        {{ m.ui.account.clear }}
      </Button>
    </template>
  </SettingsSection>
</template>
