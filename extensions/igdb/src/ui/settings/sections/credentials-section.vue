<!-- Credentials Section owns the Twitch client IGDB authenticates with. -->
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
import { TWITCH_CONSOLE_URL, type IgdbCredentialState } from '../../../shared/settings'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'

interface Props {
  credential: IgdbCredentialState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const clientIdInput = ref('')
const clientSecretInput = ref('')
const busyAction = ref<string | null>(null)
const testPassed = ref(false)

const canSave = computed(
  () => clientIdInput.value.trim().length > 0 && clientSecretInput.value.trim().length > 0
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

function saveCredential(): void {
  testPassed.value = false
  void runAction('save', async () => {
    await host.saveCredential(clientIdInput.value, clientSecretInput.value)
    clientIdInput.value = ''
    clientSecretInput.value = ''
  })
}

function clearCredential(): void {
  testPassed.value = false
  void runAction('clear', async () => {
    await host.clearCredential()
  })
}

function testConnection(): void {
  testPassed.value = false
  void runAction('test', async () => {
    await host.testConnection()
    testPassed.value = true
  })
}

function openConsole(): void {
  void host.openExternal(TWITCH_CONSOLE_URL).catch((error) => {
    emit('error', toErrorMessage(error))
  })
}
</script>

<template>
  <SettingsSection
    :title="m.ui.credentials.title"
    :description="m.ui.credentials.description"
    surface="rows"
  >
    <FieldGroup>
      <Field
        orientation="horizontal"
        :label="m.ui.credentials.statusLabel"
      >
        <FieldContent class="flex-row items-center justify-end gap-2">
          <Badge :variant="props.credential.configured ? 'success' : 'secondary'">
            {{
              props.credential.configured
                ? m.ui.credentials.configuredLabel
                : m.ui.credentials.missingLabel
            }}
          </Badge>
          <span
            v-if="props.credential.clientId"
            class="font-mono text-xs text-muted-foreground"
          >
            {{ props.credential.clientId }}
          </span>
        </FieldContent>
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.credentials.clientIdLabel"
      >
        <FieldContent>
          <Input
            v-model="clientIdInput"
            autocomplete="off"
            spellcheck="false"
            :placeholder="m.ui.credentials.clientIdPlaceholder"
            class="w-72"
          />
        </FieldContent>
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.credentials.clientSecretLabel"
      >
        <FieldContent class="flex-row items-center gap-2">
          <Input
            v-model="clientSecretInput"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :placeholder="m.ui.credentials.clientSecretPlaceholder"
            class="w-72"
          />
          <Button
            size="sm"
            type="button"
            :disabled="!canSave || busyAction !== null"
            @click="saveCredential"
          >
            <Spinner v-if="busyAction === 'save'" />
            {{ m.ui.credentials.save }}
          </Button>
        </FieldContent>
      </Field>
    </FieldGroup>

    <template #actions>
      <span
        v-if="testPassed"
        class="text-xs text-muted-foreground"
      >
        {{ m.ui.credentials.testSucceeded }}
      </span>
      <Button
        variant="outline"
        size="sm"
        type="button"
        :disabled="!props.credential.configured || busyAction !== null"
        @click="testConnection"
      >
        <Spinner v-if="busyAction === 'test'" />
        <Icon
          v-else
          icon="icon-[mdi--lan-connect]"
          class="size-3.5"
        />
        {{ m.ui.credentials.test }}
      </Button>
      <Button
        variant="outline"
        size="sm"
        type="button"
        @click="openConsole"
      >
        <Icon
          icon="icon-[mdi--open-in-new]"
          class="size-3.5"
        />
        {{ m.ui.credentials.openConsole }}
      </Button>
      <Button
        v-if="props.credential.configured"
        variant="destructive"
        size="sm"
        type="button"
        :disabled="busyAction !== null"
        @click="clearCredential"
      >
        <Spinner v-if="busyAction === 'clear'" />
        <Icon
          v-else
          icon="icon-[mdi--key-remove]"
          class="size-3.5"
        />
        {{ m.ui.credentials.clear }}
      </Button>
    </template>
  </SettingsSection>
</template>
