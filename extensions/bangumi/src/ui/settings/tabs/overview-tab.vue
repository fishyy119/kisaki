<!-- Overview Tab summarizes integration health and routes users to focused tabs. -->
<script setup lang="ts">
import { computed } from 'vue'
import { Badge, Button, Icon, type BadgeVariants } from '@kisaki3/extension-ui-vue'
import type { BangumiSettingsOverview } from '../../../shared/settings'
import { settingsForm } from '../form'
import { AUTOMATION_LABELS, AUTOMATION_STATUS_LABELS, AUTOMATION_STATUS_VARIANTS } from '../labels'
import SettingsSection from '../components/settings-section.vue'

type SettingsTabId = 'account' | 'sync' | 'import' | 'automation' | 'maintenance'

interface Props {
  overview: BangumiSettingsOverview
}

const props = defineProps<Props>()

const emit = defineEmits<{
  navigate: [tab: SettingsTabId]
}>()

const accountLabel = computed(() => {
  if (!props.overview.account.loggedIn) {
    return '未登录'
  }

  return props.overview.account.nickname
    ? `${props.overview.account.nickname} (@${props.overview.account.username ?? '-'})`
    : '已登录'
})

const accountBadge = computed<{ label: string; variant: BadgeVariants['variant'] }>(() => {
  if (!props.overview.account.hasToken) {
    return { label: '未授权', variant: 'secondary' }
  }

  return props.overview.account.expired
    ? { label: '凭据过期', variant: 'warning' }
    : { label: '可用', variant: 'success' }
})

const runningJobs = computed(() => Object.values(props.overview.activeJobs).filter(Boolean).length)

const missingAutomationCount = computed(
  () => props.overview.automations.filter((automation) => automation.status === 'missing').length
)

const syncItemsLabel = computed(() => {
  if (!settingsForm.autoSyncEnabled) {
    return '未启用'
  }

  const labels = [
    settingsForm.autoSyncItems.includes('create') ? '创建收藏' : null,
    settingsForm.autoSyncItems.includes('status') ? '游玩状态' : null,
    settingsForm.autoSyncItems.includes('score') ? '评分' : null
  ].filter(Boolean)

  return labels.length > 0 ? labels.join('、') : '未选择同步项'
})
</script>

<template>
  <div class="space-y-4">
    <SettingsSection title="状态概览">
      <div class="overflow-hidden rounded-md border border-border bg-background/60">
        <div class="grid -m-px lg:grid-cols-3">
          <button
            type="button"
            class="border-r border-b border-border px-3 py-2 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            @click="emit('navigate', 'account')"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <span class="text-xs text-muted-foreground">账号</span>
                <div class="mt-1 truncate text-sm font-medium">{{ accountLabel }}</div>
              </div>
              <Badge :variant="accountBadge.variant">{{ accountBadge.label }}</Badge>
            </div>
          </button>

          <button
            type="button"
            class="border-r border-b border-border px-3 py-2 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            @click="emit('navigate', 'sync')"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-muted-foreground">自动同步</span>
              <Badge :variant="settingsForm.autoSyncEnabled ? 'success' : 'secondary'">
                {{ settingsForm.autoSyncEnabled ? '已启用' : '未启用' }}
              </Badge>
            </div>
            <div class="mt-1 truncate text-sm font-medium">{{ syncItemsLabel }}</div>
          </button>

          <button
            type="button"
            class="border-r border-b border-border px-3 py-2 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            @click="emit('navigate', 'automation')"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-muted-foreground">推荐自动化</span>
              <Badge :variant="missingAutomationCount === 0 ? 'success' : 'warning'">
                {{ missingAutomationCount === 0 ? '已齐全' : `${missingAutomationCount} 项未创建` }}
              </Badge>
            </div>
            <div class="mt-1 truncate text-sm font-medium">
              {{ props.overview.automations.length }} 个模板
            </div>
          </button>
        </div>
      </div>
    </SettingsSection>

    <SettingsSection title="运行状态">
      <div class="overflow-hidden rounded-md border border-border bg-background/60">
        <div class="grid -m-px sm:grid-cols-2">
          <div class="border-r border-b border-border px-3 py-2">
            <div class="text-xs text-muted-foreground">正在运行的 Bangumi 任务</div>
            <div class="mt-1 flex items-center gap-2">
              <span class="text-lg leading-tight font-semibold">{{ runningJobs }}</span>
              <Badge :variant="runningJobs > 0 ? 'warning' : 'secondary'">
                {{ runningJobs > 0 ? '运行中' : '空闲' }}
              </Badge>
            </div>
          </div>
          <div class="border-r border-b border-border px-3 py-2">
            <div class="text-xs text-muted-foreground">可用本地资源</div>
            <div class="mt-1 text-sm">
              {{ props.overview.profiles.length }} 个刮削配置 /
              {{ props.overview.collections.length }} 个合集
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>

    <SettingsSection title="快捷入口">
      <div class="grid gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          size="sm"
          type="button"
          class="justify-start"
          @click="emit('navigate', 'import')"
        >
          <Icon
            icon="icon-[mdi--database-import-outline]"
            class="size-3.5"
          />
          导入 Bangumi 收藏或目录
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          class="justify-start"
          @click="emit('navigate', 'maintenance')"
        >
          <Icon
            icon="icon-[mdi--tune-variant]"
            class="size-3.5"
          />
          调整网络和维护选项
        </Button>
      </div>
    </SettingsSection>

    <SettingsSection title="自动化模板">
      <div class="divide-y divide-border rounded-md border border-border">
        <div
          v-for="automation in props.overview.automations"
          :key="automation.kind"
          class="flex items-center justify-between gap-3 px-3 py-2"
        >
          <span class="min-w-0 truncate text-sm">{{ AUTOMATION_LABELS[automation.kind] }}</span>
          <Badge :variant="AUTOMATION_STATUS_VARIANTS[automation.status]">
            {{ AUTOMATION_STATUS_LABELS[automation.status] }}
          </Badge>
        </div>
      </div>
    </SettingsSection>
  </div>
</template>
