<!-- Credentials Section owns the YMGal OAuth client and the connection test. -->
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
import { YMGAL_DEVELOPER_URL, type YmgalCredentialState } from '../../../shared/settings'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'

interface Props {
  credential: YmgalCredentialState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const clientIdInput = ref('')
const clientSecretInput = ref('')
const busyAction = ref<string | null>(null)

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
  void runAction('save', async () => {
    await host.saveCredential(clientIdInput.value, clientSecretInput.value)
    clientIdInput.value = ''
    clientSecretInput.value = ''
  })
}

function clearCredential(): void {
  void runAction('clear', async () => {
    await host.clearCredential()
  })
}

function testConnection(): void {
  void runAction('test', () => host.testConnection())
}

function openDeveloperPage(): void {
  void host.openExternal(YMGAL_DEVELOPER_URL).catch((error) => {
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
                ? m.ui.credentials.customLabel
                : m.ui.credentials.sharedLabel
            }}
          </Badge>
          <span class="font-mono text-xs text-muted-foreground">
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
      <Button
        variant="outline"
        size="sm"
        type="button"
        :disabled="busyAction !== null"
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
        @click="openDeveloperPage"
      >
        <Icon
          icon="icon-[mdi--open-in-new]"
          class="size-3.5"
        />
        {{ m.ui.credentials.openDeveloper }}
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
