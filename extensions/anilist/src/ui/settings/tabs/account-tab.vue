<!-- Account Tab owns the browser sign-in lifecycle and token expiry display. -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Badge,
  Button,
  Field,
  FieldContent,
  FieldGroup,
  Icon,
  SettingsSection,
  Spinner
} from '@kisaki3/extension-ui-vue'
import type { AnilistAccountState, AnilistAccountVerification } from '../../../shared/settings'
import { m, uiLocale } from '../i18n'
import { host, toErrorMessage } from '../rpc'

interface Props {
  account: AnilistAccountState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const verification = ref<AnilistAccountVerification | null>(null)
const busyAction = ref<string | null>(null)

const tokenExpired = computed(
  () => props.account.expiresAt !== undefined && props.account.expiresAt <= Date.now()
)
const expiresAtLabel = computed(() =>
  props.account.expiresAt !== undefined
    ? new Date(props.account.expiresAt).toLocaleString(uiLocale.value, { hour12: false })
    : null
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

function reopenAuthorize(): void {
  void runAction('reopen', async () => {
    await host.reopenPendingAuthorize()
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
        :description="props.account.loginPending ? m.ui.account.pendingHint : undefined"
      >
        <FieldContent class="flex-row items-center justify-end gap-2">
          <span
            v-if="verification"
            class="text-xs text-muted-foreground"
          >
            {{ m.ui.account.verifiedAs({ userName: verification.userName }) }}
          </span>
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
        v-if="expiresAtLabel"
        orientation="horizontal"
        :label="m.ui.account.expiresAtLabel"
      >
        <FieldContent class="flex-row items-center justify-end gap-2">
          <Badge
            v-if="tokenExpired"
            variant="destructive"
          >
            {{ m.ui.account.expiredLabel }}
          </Badge>
          <span class="text-xs text-muted-foreground">{{ expiresAtLabel }}</span>
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
          @click="reopenAuthorize"
        >
          <Spinner v-if="busyAction === 'reopen'" />
          <Icon
            v-else
            icon="icon-[mdi--open-in-new]"
            class="size-3.5"
          />
          {{ m.ui.account.reopenAuthorize }}
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
