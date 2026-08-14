<!--
TMDB Settings App is the webview root: it loads the overview, owns the
preference draft lifecycle, and surfaces notices raised by the sections.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Alert, Button, Spinner, WebviewDialogShell } from '@kisaki3/extension-ui-vue'
import {
  matchesHttpUrlFormat,
  type TmdbSettingsFormState,
  type TmdbSettingsOverview
} from '../../shared/settings'
import { applySettingsForm, settingsForm, settingsFormsEqual, snapshotSettingsForm } from './form'
import { m } from './i18n'
import { host, toErrorMessage } from './rpc'
import CredentialsSection from './sections/credentials-section.vue'
import EndpointsSection from './sections/endpoints-section.vue'
import EpisodeGroupsSection from './sections/episode-groups-section.vue'
import PreferencesSection from './sections/preferences-section.vue'

const NOTICE_TIMEOUT_MS = 2000

const overview = ref<TmdbSettingsOverview | null>(null)
const savedForm = ref<TmdbSettingsFormState | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)

let noticeTimer: ReturnType<typeof setTimeout> | null = null

const isDirty = computed(
  () => savedForm.value !== null && !settingsFormsEqual(settingsForm, savedForm.value)
)
// A rejected endpoint would silently fall back to the default on save.
const isValid = computed(
  () =>
    matchesHttpUrlFormat(settingsForm.apiBaseUrl) && matchesHttpUrlFormat(settingsForm.imageBaseUrl)
)

onMounted(() => {
  void reload({ keepDraft: false })
})

onUnmounted(() => {
  if (noticeTimer) {
    clearTimeout(noticeTimer)
  }
})

async function reload(options: { keepDraft: boolean }): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const next = await host.getOverview()
    overview.value = next
    if (!options.keepDraft) {
      applySettingsForm(next.form)
      savedForm.value = snapshotSettingsForm(next.form)
    }
  } catch (cause) {
    error.value = toErrorMessage(cause)
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  saving.value = true
  error.value = null
  try {
    await host.saveSettings(snapshotSettingsForm())
    await reload({ keepDraft: false })
    showNotice(m.value.ui.saved)
  } catch (cause) {
    error.value = toErrorMessage(cause)
  } finally {
    saving.value = false
  }
}

function discardDraft(): void {
  if (savedForm.value) {
    applySettingsForm(savedForm.value)
  }
}

function showNotice(message: string): void {
  notice.value = message
  error.value = null
  if (noticeTimer) {
    clearTimeout(noticeTimer)
  }
  noticeTimer = setTimeout(() => {
    notice.value = null
  }, NOTICE_TIMEOUT_MS)
}

function reportError(message: string): void {
  error.value = message
}
</script>

<template>
  <WebviewDialogShell :title="m.settings.webviewTitle">
    <div
      v-if="overview"
      class="mx-auto max-w-3xl space-y-4"
    >
      <Alert
        v-if="error"
        variant="destructive"
      >
        {{ error }}
      </Alert>

      <Alert
        v-if="notice"
        variant="success"
      >
        {{ notice }}
      </Alert>

      <CredentialsSection
        :credential="overview.credential"
        @refresh="() => void reload({ keepDraft: isDirty })"
        @error="reportError"
        @notice="showNotice"
      />

      <EndpointsSection />

      <PreferencesSection
        @refresh="() => void reload({ keepDraft: false })"
        @error="reportError"
        @notice="showNotice"
      />

      <EpisodeGroupsSection />
    </div>

    <main
      v-else
      class="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      <Spinner v-if="loading" />
      {{ loading ? m.ui.loading : m.ui.unavailable }}
    </main>

    <template
      v-if="overview && isDirty"
      #footer
    >
      <span class="mr-auto text-xs text-muted-foreground">{{ m.ui.unsavedChanges }}</span>
      <Button
        variant="outline"
        type="button"
        :disabled="saving"
        @click="discardDraft"
      >
        {{ m.ui.discardChanges }}
      </Button>
      <Button
        type="button"
        :disabled="saving || loading || !isValid"
        @click="save"
      >
        <Spinner v-if="saving" />
        {{ m.ui.savePreferences }}
      </Button>
    </template>
  </WebviewDialogShell>
</template>
