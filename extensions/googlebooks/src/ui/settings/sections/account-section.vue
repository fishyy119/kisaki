<!--
Account Section owns the relay sign-in lifecycle and the optional search-quota
API key.
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
import type { GbooksAccountState } from '../../../shared/settings'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'

interface Props {
  account: GbooksAccountState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const keyInput = ref('')
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

function startLogin(): void {
  void runAction('login', async () => {
    await host.startLogin()
  })
}

function completeLogin(): void {
  void runAction('complete', async () => {
    await host.completePendingLogin()
  })
}

function cancelLogin(): void {
  void runAction('cancel', async () => {
    await host.cancelPendingLogin()
  })
}

function logout(): void {
  void runAction('logout', async () => {
    await host.logout()
  })
}

function saveKey(): void {
  void runAction('saveKey', async () => {
    await host.saveApiKey(keyInput.value)
    keyInput.value = ''
  })
}

function clearKey(): void {
  void runAction('clearKey', async () => {
    await host.clearApiKey()
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
          <Badge
            v-if="props.account.apiKeyConfigured"
            variant="secondary"
          >
            {{ m.ui.account.apiKeyConfigured }}
          </Badge>
          <Badge
            v-if="props.account.loginPending"
            variant="secondary"
          >
            {{ m.ui.account.pendingLabel }}
          </Badge>
          <Badge :variant="props.account.configured ? 'success' : 'secondary'">
            {{
              props.account.configured ? m.ui.account.configuredLabel : m.ui.account.missingLabel
            }}
          </Badge>
        </FieldContent>
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.account.apiKeyLabel"
        :description="m.ui.account.apiKeyDescription"
      >
        <FieldContent class="flex-row items-center justify-end gap-2">
          <Input
            v-model="keyInput"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :placeholder="m.ui.account.apiKeyPlaceholder"
            class="w-64"
          />
          <Button
            size="sm"
            type="button"
            :disabled="!keyInput.trim() || busyAction !== null"
            @click="saveKey"
          >
            <Spinner v-if="busyAction === 'saveKey'" />
            {{ m.ui.account.saveKey }}
          </Button>
          <Button
            v-if="props.account.apiKeyConfigured"
            variant="outline"
            size="sm"
            type="button"
            :disabled="busyAction !== null"
            @click="clearKey"
          >
            {{ m.ui.account.clearKey }}
          </Button>
        </FieldContent>
      </Field>
    </FieldGroup>

    <template #actions>
      <template v-if="props.account.loginPending">
        <Button
          size="sm"
          type="button"
          :disabled="busyAction !== null"
          @click="completeLogin"
        >
          <Spinner v-if="busyAction === 'complete'" />
          <Icon
            v-else
            icon="icon-[mdi--check]"
            class="size-3.5"
          />
          {{ m.ui.account.completeLogin }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          :disabled="busyAction !== null"
          @click="cancelLogin"
        >
          {{ m.ui.account.cancelLogin }}
        </Button>
      </template>
      <Button
        v-else
        size="sm"
        type="button"
        :disabled="busyAction !== null"
        @click="startLogin"
      >
        <Spinner v-if="busyAction === 'login'" />
        <Icon
          v-else
          icon="icon-[mdi--login]"
          class="size-3.5"
        />
        {{ m.ui.account.login }}
      </Button>
      <Button
        v-if="props.account.configured"
        variant="destructive"
        size="sm"
        type="button"
        :disabled="busyAction !== null"
        @click="logout"
      >
        <Spinner v-if="busyAction === 'logout'" />
        <Icon
          v-else
          icon="icon-[mdi--logout]"
          class="size-3.5"
        />
        {{ m.ui.account.logout }}
      </Button>
    </template>
  </SettingsSection>
</template>
