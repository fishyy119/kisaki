<!-- Credentials Section owns the TMDB API key lifecycle and the connection test. -->
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
import { TMDB_API_SETTINGS_URL, type TmdbCredentialState } from '../../../shared/settings'
import { m } from '../i18n'
import { host, toErrorMessage } from '../rpc'

interface Props {
  credential: TmdbCredentialState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const keyInput = ref('')
const busyAction = ref<string | null>(null)
const testPassed = ref(false)

const modeLabel = computed(() =>
  props.credential.mode === 'bearer'
    ? m.value.ui.credentials.modeBearer
    : m.value.ui.credentials.modeApiKey
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

function saveKey(): void {
  testPassed.value = false
  void runAction('save', async () => {
    await host.saveApiKey(keyInput.value)
    keyInput.value = ''
  })
}

function clearKey(): void {
  testPassed.value = false
  void runAction('clear', async () => {
    await host.clearApiKey()
  })
}

function testConnection(): void {
  testPassed.value = false
  void runAction('test', async () => {
    await host.testConnection()
    testPassed.value = true
  })
}

function openApiSettings(): void {
  void host.openExternal(TMDB_API_SETTINGS_URL).catch((error) => {
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
          <Badge
            v-if="props.credential.configured"
            variant="secondary"
          >
            {{ modeLabel }}
          </Badge>
        </FieldContent>
      </Field>

      <Field
        orientation="horizontal"
        :label="m.ui.credentials.inputLabel"
      >
        <FieldContent class="flex-row items-center gap-2">
          <Input
            v-model="keyInput"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :placeholder="m.ui.credentials.inputPlaceholder"
            class="w-72"
          />
          <Button
            size="sm"
            type="button"
            :disabled="!keyInput.trim() || busyAction !== null"
            @click="saveKey"
          >
            <Spinner v-if="busyAction === 'save'" />
            {{ m.ui.credentials.save }}
          </Button>
        </FieldContent>
      </Field>
    </FieldGroup>

    <template #actions>
      <div class="flex flex-wrap items-center gap-2">
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
          @click="openApiSettings"
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
          @click="clearKey"
        >
          <Spinner v-if="busyAction === 'clear'" />
          <Icon
            v-else
            icon="icon-[mdi--key-remove]"
            class="size-3.5"
          />
          {{ m.ui.credentials.clear }}
        </Button>
      </div>
    </template>
  </SettingsSection>
</template>
