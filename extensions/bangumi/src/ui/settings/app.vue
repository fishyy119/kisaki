<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
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

type TabId = (typeof TABS)[number]['id']

const activeTab = ref<TabId>('account')
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
  <div class="flex h-screen flex-col">
    <nav class="flex items-center gap-1 border-b border-border px-4 pt-2.5">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        type="button"
        class="rounded-t-md rounded-b-none border-none bg-transparent px-3 py-[7px]"
        :class="
          activeTab === tab.id
            ? 'bg-surface text-foreground shadow-[inset_0_-2px_0_var(--color-primary)]'
            : 'text-muted-foreground'
        "
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
      <span class="flex-1" />
      <button
        type="button"
        :disabled="loading"
        @click="reload"
      >
        刷新
      </button>
    </nav>

    <p
      v-if="error"
      class="notice notice-danger mx-4 mt-2"
    >
      {{ error }}
    </p>

    <main
      v-if="overview"
      class="flex-1 overflow-y-auto px-4 py-3"
    >
      <AccountTab
        v-if="activeTab === 'account'"
        :overview="overview"
        @refresh="reload"
        @error="reportError"
      />
      <SyncTab
        v-else-if="activeTab === 'sync'"
        :overview="overview"
        @refresh="reload"
        @error="reportError"
      />
      <ImportTab
        v-else-if="activeTab === 'import'"
        :overview="overview"
        @refresh="reload"
        @error="reportError"
      />
      <AutomationTab
        v-else-if="activeTab === 'automation'"
        :overview="overview"
        @refresh="reload"
        @error="reportError"
      />
      <AdvancedTab
        v-else
        @refresh="reload"
        @error="reportError"
      />
    </main>
    <main
      v-else
      class="flex flex-1 items-center justify-center text-muted-foreground"
    >
      {{ loading ? '正在加载设置...' : '设置不可用' }}
    </main>

    <footer class="flex items-center justify-end gap-3 border-t border-border px-4 py-2.5">
      <span
        v-if="savedNotice"
        class="text-xs text-muted-foreground"
      >
        Bangumi 设置已保存。
      </span>
      <button
        type="button"
        class="border-transparent bg-primary text-primary-foreground"
        :disabled="saving || loading"
        @click="save"
      >
        保存设置
      </button>
    </footer>
  </div>
</template>
