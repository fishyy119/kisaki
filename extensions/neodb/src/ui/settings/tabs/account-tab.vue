<!--
Account Tab owns the instance sign-in lifecycle: the browser flow, the
manual-code flow for instances that cannot bounce back, verification, and
signing out.
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
import type { NeodbAccountState, NeodbAccountVerification } from '../../../shared/settings'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'

interface Props {
  account: NeodbAccountState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const codeInput = ref('')
const verification = ref<NeodbAccountVerification | null>(null)
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

function startManualLogin(): void {
  void runAction('manual', async () => {
    await host.startManualLogin()
  })
}

function completeManualLogin(): void {
  void runAction('complete', async () => {
    await host.completeManualLogin(codeInput.value)
    codeInput.value = ''
  })
}

function cancelLogin(): void {
  void runAction('cancel', async () => {
    await host.cancelPendingLogin()
  })
}

function logout(): void {
  verification.value = null
  void runAction('logout', async () => {
    await host.logout()
  })
}

function verifyAccount(): void {
  void runAction('verify', async () => {
    verification.value = await host.verifyAccount()
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
          <span
            v-else-if="props.account.instanceUrl"
            class="text-xs text-muted-foreground"
          >
            {{ m.ui.account.instanceLabel({ instanceUrl: props.account.instanceUrl }) }}
          </span>
          <Badge
            v-if="props.account.loginPending"
            variant="secondary"
          >
            {{
              props.account.loginManual
                ? m.ui.account.manualPendingLabel
                : m.ui.account.pendingLabel
            }}
          </Badge>
          <Badge :variant="props.account.configured ? 'success' : 'secondary'">
            {{
              props.account.configured ? m.ui.account.configuredLabel : m.ui.account.missingLabel
            }}
          </Badge>
        </FieldContent>
      </Field>

      <Field
        v-if="props.account.loginPending && props.account.loginManual"
        orientation="horizontal"
        :label="m.ui.account.completeManual"
      >
        <FieldContent class="flex-row items-center gap-2">
          <Input
            v-model="codeInput"
            autocomplete="off"
            spellcheck="false"
            :placeholder="m.ui.account.codePlaceholder"
            class="w-72"
          />
          <Button
            size="sm"
            type="button"
            :disabled="!codeInput.trim() || busyAction !== null"
            @click="completeManualLogin"
          >
            <Spinner v-if="busyAction === 'complete'" />
            {{ m.ui.account.completeManual }}
          </Button>
        </FieldContent>
      </Field>
    </FieldGroup>

    <template #actions>
      <Button
        v-if="props.account.loginPending"
        variant="outline"
        size="sm"
        type="button"
        :disabled="busyAction !== null"
        @click="cancelLogin"
      >
        {{ m.ui.account.cancelLogin }}
      </Button>
      <template v-else>
        <Button
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
          variant="outline"
          size="sm"
          type="button"
          :disabled="busyAction !== null"
          @click="startManualLogin"
        >
          <Spinner v-if="busyAction === 'manual'" />
          <Icon
            v-else
            icon="icon-[mdi--form-textbox-password]"
            class="size-3.5"
          />
          {{ m.ui.account.manualLogin }}
        </Button>
      </template>
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
