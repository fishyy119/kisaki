<!--
Steam Settings App is the webview root: tab navigation, preference draft
lifecycle, and load/action error surfacing. Immediate actions live in tab
components, and their successful results are reported by the host through the
app's own notifications.
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Alert,
  Button,
  Icon,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  WebviewDialogShell
} from '@kisaki3/extension-ui-vue'
import {
  matchesSteamId64Format,
  type SteamSettingsFormState,
  type SteamSettingsOverview
} from '../../shared/settings'
import { applySettingsForm, settingsForm, settingsFormsEqual, snapshotSettingsForm } from './form'
import { m } from './i18n'
import { host, toErrorMessage } from './rpc'
import OverviewTab from './tabs/overview-tab.vue'
import AccountTab from './tabs/account-tab.vue'
import ImportTab from './tabs/import-tab.vue'
import AutomationTab from './tabs/automation-tab.vue'
import MaintenanceTab from './tabs/maintenance-tab.vue'

type SettingsTabId = 'overview' | 'account' | 'import' | 'automation' | 'maintenance'

const TAB_ICONS: Record<SettingsTabId, string> = {
  overview: 'icon-[mdi--view-dashboard-outline]',
  account: 'icon-[mdi--account-circle-outline]',
  import: 'icon-[mdi--database-import-outline]',
  automation: 'icon-[mdi--calendar-sync-outline]',
  maintenance: 'icon-[mdi--tune-variant]'
}

const tabs = computed(() =>
  (Object.keys(TAB_ICONS) as SettingsTabId[]).map((id) => ({
    id,
    label: m.value.ui.tabs[id],
    icon: TAB_ICONS[id]
  }))
)

const activeTab = ref<SettingsTabId>('overview')
const overview = ref<SteamSettingsOverview | null>(null)
const savedForm = ref<SteamSettingsFormState | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)

const isDirty = computed(
  () => savedForm.value !== null && !settingsFormsEqual(settingsForm, savedForm.value)
)
// An invalid SteamID would silently normalize to empty on save.
const isValid = computed(
  () => settingsForm.steamId === '' || matchesSteamId64Format(settingsForm.steamId)
)

onMounted(() => {
  void reload({ keepDraft: false })
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

function reportError(message: string): void {
  error.value = message
}

function navigate(tab: SettingsTabId): void {
  activeTab.value = tab
}
</script>

<template>
  <WebviewDialogShell
    :title="m.settings.webviewTitle"
    content-class="p-0 overflow-hidden"
  >
    <Tabs
      v-if="overview"
      v-model="activeTab"
      orientation="vertical"
      class="h-full min-h-0 flex-row gap-0"
    >
      <aside class="flex w-40 shrink-0 flex-col border-r border-border p-2">
        <TabsList class="h-auto w-full flex-col items-stretch">
          <TabsTrigger
            v-for="tab in tabs"
            :key="tab.id"
            :value="tab.id"
            class="h-8 justify-start px-2"
          >
            <Icon
              :icon="tab.icon"
              class="size-3.5"
            />
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>
      </aside>

      <main class="min-w-0 flex-1 overflow-y-auto">
        <div class="mx-auto max-w-4xl space-y-4 px-4 py-4">
          <Alert
            v-if="error"
            variant="destructive"
          >
            {{ error }}
          </Alert>

          <TabsContent
            value="overview"
            class="mt-0"
          >
            <OverviewTab
              :overview="overview"
              @navigate="navigate"
            />
          </TabsContent>
          <TabsContent
            value="account"
            class="mt-0"
          >
            <AccountTab
              :account="overview.account"
              @refresh="() => void reload({ keepDraft: isDirty })"
              @error="reportError"
            />
          </TabsContent>
          <TabsContent
            value="import"
            class="mt-0"
          >
            <ImportTab @error="reportError" />
          </TabsContent>
          <TabsContent
            value="automation"
            class="mt-0"
          >
            <AutomationTab
              :overview="overview"
              @refresh="() => void reload({ keepDraft: isDirty })"
              @error="reportError"
            />
          </TabsContent>
          <TabsContent
            value="maintenance"
            class="mt-0"
          >
            <MaintenanceTab
              @refresh="() => void reload({ keepDraft: false })"
              @error="reportError"
            />
          </TabsContent>
        </div>
      </main>
    </Tabs>

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
