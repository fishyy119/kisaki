<!--
Bangumi Settings App is the settings webview document root: tab shell, shared
form lifecycle, and save of the settings overview.
Boundary: talks to the extension host only through the typed `host` RPC
facade; host-side job events push refreshes into this document.
-->
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Alert, Button, Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from '@kisaki3/extension-ui-vue'
import type { BangumiSettingsOverview } from '../../shared/settings'
import { applySettingsForm, settingsForm } from './form'
import { host, onHostRefreshRequested, toErrorMessage } from './rpc'
import AccountTab from './tabs/account-tab.vue'
import SyncTab from './tabs/sync-tab.vue'
import ImportTab from './tabs/import-tab.vue'
import AutomationTab from './tabs/automation-tab.vue'
import AdvancedTab from './tabs/advanced-tab.vue'

const TABS = [
  { id: 'account', label: '账号' },
  { id: 'sync', label: '同步' },
  { id: 'import', label: '导入' },
  { id: 'automation', label: '自动化' },
  { id: 'advanced', label: '高级' }
] as const

const activeTab = ref<string>('account')
const overview = ref<BangumiSettingsOverview | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const savedNotice = ref(false)

let stopRefreshListener: (() => void) | null = null
let savedNoticeTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  stopRefreshListener = onHostRefreshRequested(() => {
    void reload()
  })
  void reload()
})

onUnmounted(() => {
  stopRefreshListener?.()
})

async function reload(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const next = await host.getOverview()
    overview.value = next
    applySettingsForm(next.form)
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
    await host.saveSettings({ ...settingsForm, autoSyncItems: [...settingsForm.autoSyncItems] })
    await reload()
    savedNotice.value = true
    if (savedNoticeTimer) {
      clearTimeout(savedNoticeTimer)
    }
    savedNoticeTimer = setTimeout(() => {
      savedNotice.value = false
    }, 2000)
  } catch (cause) {
    error.value = toErrorMessage(cause)
  } finally {
    saving.value = false
  }
}

function reportError(message: string): void {
  error.value = message
}
</script>

<template>
  <Tabs
    v-model="activeTab"
    class="h-screen gap-0"
  >
    <header class="border-b border-border px-4 py-2.5">
      <TabsList>
        <TabsTrigger
          v-for="tab in TABS"
          :key="tab.id"
          :value="tab.id"
        >
          {{ tab.label }}
        </TabsTrigger>
      </TabsList>
    </header>

    <main
      v-if="overview"
      class="flex-1 space-y-3 overflow-y-auto px-4 py-3"
    >
      <Alert
        v-if="error"
        variant="destructive"
      >
        {{ error }}
      </Alert>

      <TabsContent value="account">
        <AccountTab
          :overview="overview"
          @refresh="reload"
          @error="reportError"
        />
      </TabsContent>
      <TabsContent value="sync">
        <SyncTab
          :overview="overview"
          @refresh="reload"
          @error="reportError"
        />
      </TabsContent>
      <TabsContent value="import">
        <ImportTab
          :overview="overview"
          @refresh="reload"
          @error="reportError"
        />
      </TabsContent>
      <TabsContent value="automation">
        <AutomationTab
          :overview="overview"
          @refresh="reload"
          @error="reportError"
        />
      </TabsContent>
      <TabsContent value="advanced">
        <AdvancedTab
          @refresh="reload"
          @error="reportError"
        />
      </TabsContent>
    </main>
    <main
      v-else
      class="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      <Spinner v-if="loading" />
      {{ loading ? '正在加载设置…' : '设置不可用' }}
    </main>

    <footer class="flex items-center justify-end gap-3 border-t border-border px-4 py-2.5">
      <span
        v-if="savedNotice"
        class="text-xs text-muted-foreground"
      >
        Bangumi 设置已保存。
      </span>
      <Button
        type="button"
        :disabled="saving || loading"
        @click="save"
      >
        <Spinner v-if="saving" />
        保存设置
      </Button>
    </footer>
  </Tabs>
</template>
