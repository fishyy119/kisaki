<!-- Credentials Section owns the optional VNDB token and the connection test. -->
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
import { VNDB_TOKEN_SETTINGS_URL, type VndbCredentialState } from '../../../shared/settings'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'

interface Props {
  credential: VndbCredentialState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const tokenInput = ref('')
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

function saveToken(): void {
  void runAction('save', async () => {
    await host.saveToken(tokenInput.value)
    tokenInput.value = ''
  })
}

function clearToken(): void {
  void runAction('clear', async () => {
    await host.clearToken()
  })
}

function testConnection(): void {
  void runAction('test', () => host.testConnection())
}

function openTokenSettings(): void {
  void host.openExternal(VNDB_TOKEN_SETTINGS_URL).catch((error) => {
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
        </FieldContent>
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.credentials.inputLabel"
      >
        <FieldContent class="flex-row items-center gap-2">
          <Input
            v-model="tokenInput"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :placeholder="m.ui.credentials.inputPlaceholder"
            class="w-72"
          />
          <Button
            size="sm"
            type="button"
            :disabled="!tokenInput.trim() || busyAction !== null"
            @click="saveToken"
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
        @click="openTokenSettings"
      >
        <Icon
          icon="icon-[mdi--open-in-new]"
          class="size-3.5"
        />
        {{ m.ui.credentials.openSettings }}
      </Button>
      <Button
        v-if="props.credential.configured"
        variant="destructive"
        size="sm"
        type="button"
        :disabled="busyAction !== null"
        @click="clearToken"
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
