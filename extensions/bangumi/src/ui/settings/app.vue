<!--
Bangumi Settings App is the webview root: tab navigation, preference draft
lifecycle, and host refresh handling. Immediate actions live in tab components.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  Alert,
  Button,
  Icon,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@kisaki3/extension-ui-vue'
import type { BangumiSettingsFormState, BangumiSettingsOverview } from '../../shared/settings'
import { applySettingsForm, settingsFormsEqual, settingsForm, snapshotSettingsForm } from './form'
import { host, onHostRefreshRequested, toErrorMessage } from './rpc'
import OverviewTab from './tabs/overview-tab.vue'
import AccountTab from './tabs/account-tab.vue'
import SyncTab from './tabs/sync-tab.vue'
import ImportTab from './tabs/import-tab.vue'
import AutomationTab from './tabs/automation-tab.vue'
import MaintenanceTab from './tabs/maintenance-tab.vue'

type SettingsTabId = 'overview' | 'account' | 'sync' | 'import' | 'automation' | 'maintenance'

const TABS: readonly { id: SettingsTabId; label: string; icon: string }[] = [
  { id: 'overview', label: '总览', icon: 'icon-[mdi--view-dashboard-outline]' },
  { id: 'account', label: '账号', icon: 'icon-[mdi--account-circle-outline]' },
  { id: 'sync', label: '同步', icon: 'icon-[mdi--sync]' },
  { id: 'import', label: '导入', icon: 'icon-[mdi--database-import-outline]' },
  { id: 'automation', label: '自动化', icon: 'icon-[mdi--calendar-sync-outline]' },
  { id: 'maintenance', label: '维护', icon: 'icon-[mdi--tune-variant]' }
]

const activeTab = ref<SettingsTabId>('overview')
const overview = ref<BangumiSettingsOverview | null>(null)
const savedForm = ref<BangumiSettingsFormState | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const savedNotice = ref(false)

let stopRefreshListener: (() => void) | null = null
let savedNoticeTimer: ReturnType<typeof setTimeout> | null = null

const isDirty = computed(
  () => savedForm.value !== null && !settingsFormsEqual(settingsForm, savedForm.value)
)

onMounted(() => {
  stopRefreshListener = onHostRefreshRequested(() => {
    void reload({ keepDraft: isDirty.value })
  })
  void reload({ keepDraft: false })
})

onUnmounted(() => {
  stopRefreshListener?.()
  if (savedNoticeTimer) {
    clearTimeout(savedNoticeTimer)
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
    showSavedNotice()
  } catch (cause) {
    error.value = toErrorMessage(cause)
  } finally {
    saving.value = false
  }
}

function discardDraft(): void {
  if (!savedForm.value) {
    return
  }

  applySettingsForm(savedForm.value)
}

function showSavedNotice(): void {
  savedNotice.value = true
  if (savedNoticeTimer) {
    clearTimeout(savedNoticeTimer)
  }
  savedNoticeTimer = setTimeout(() => {
    savedNotice.value = false
  }, 2000)
}

function reportError(message: string): void {
  error.value = message
}

function navigate(tab: SettingsTabId): void {
  activeTab.value = tab
}
</script>

<template>
  <Tabs
    v-model="activeTab"
    orientation="vertical"
    class="h-screen gap-0 overflow-hidden"
  >
    <div
      v-if="overview"
      class="flex min-h-0 flex-1"
    >
      <aside class="flex w-40 shrink-0 flex-col border-r border-border bg-surface/60 p-2">
        <TabsList class="h-auto w-full flex-col items-stretch">
          <TabsTrigger
            v-for="tab in TABS"
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

          <Alert
            v-if="savedNotice"
            variant="success"
          >
            Bangumi 设置已保存。
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
              :overview="overview"
              @refresh="() => void reload({ keepDraft: isDirty })"
              @error="reportError"
            />
          </TabsContent>
          <TabsContent
            value="sync"
            class="mt-0"
          >
            <SyncTab
              :overview="overview"
              @refresh="() => void reload({ keepDraft: isDirty })"
              @error="reportError"
            />
          </TabsContent>
          <TabsContent
            value="import"
            class="mt-0"
          >
            <ImportTab
              :overview="overview"
              @refresh="() => void reload({ keepDraft: isDirty })"
              @error="reportError"
            />
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
    </div>

    <main
      v-else
      class="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      <Spinner v-if="loading" />
      {{ loading ? '正在加载 Bangumi 设置…' : 'Bangumi 设置不可用' }}
    </main>

    <footer
      v-if="overview && isDirty"
      class="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-2.5"
    >
      <span class="mr-auto text-xs text-muted-foreground">偏好设置有未保存更改</span>
      <Button
        variant="outline"
        type="button"
        :disabled="saving"
        @click="discardDraft"
      >
        放弃更改
      </Button>
      <Button
        type="button"
        :disabled="saving || loading"
        @click="save"
      >
        <Spinner v-if="saving" />
        保存偏好
      </Button>
    </footer>
  </Tabs>
</template>
