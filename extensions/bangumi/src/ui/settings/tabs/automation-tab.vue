<!-- Automation Tab creates recommended app-owned automations for Bangumi commands. -->
<script setup lang="ts">
import { ref } from 'vue'
import { Badge, Button, Icon, Spinner } from '@kisaki3/extension-ui-vue'
import type { BangumiAutomationKind, BangumiSettingsOverview } from '../../../shared/settings'
import { host, toErrorMessage } from '../rpc'
import {
  AUTOMATION_LABELS,
  AUTOMATION_STATUS_LABELS,
  AUTOMATION_STATUS_VARIANTS
} from '../labels'
import SettingsSection from '../components/settings-section.vue'

interface Props {
  overview: BangumiSettingsOverview
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const AUTOMATION_DESCRIPTIONS: Record<BangumiAutomationKind, string> = {
  'auth-refresh': '应用启动时刷新并验证 Bangumi 凭据。',
  'sync-changed': '应用启动后同步上次运行期积累的本地变更。',
  'sync-full-daily': '每天凌晨执行一次游戏全量同步。'
}

const creatingKind = ref<BangumiAutomationKind | null>(null)

async function create(kind: BangumiAutomationKind): Promise<void> {
  creatingKind.value = kind
  try {
    await host.createAutomation(kind)
    emit('refresh')
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    creatingKind.value = null
  }
}
</script>

<template>
  <SettingsSection
    title="推荐自动化"
    description="这里只创建 Bangumi 推荐模板；启停、触发条件和历史由主应用自动化页面负责。"
  >
    <div class="divide-y divide-border rounded-md border border-border">
      <div
        v-for="automation in props.overview.automations"
        :key="automation.kind"
        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2"
      >
        <div class="min-w-0">
          <div class="truncate text-sm font-medium">
            {{ AUTOMATION_LABELS[automation.kind] }}
          </div>
          <div class="text-xs text-muted-foreground">
            {{ AUTOMATION_DESCRIPTIONS[automation.kind] }}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Badge :variant="AUTOMATION_STATUS_VARIANTS[automation.status]">
            {{ AUTOMATION_STATUS_LABELS[automation.status] }}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            type="button"
            :disabled="automation.status !== 'missing' || creatingKind !== null"
            @click="create(automation.kind)"
          >
            <Spinner v-if="creatingKind === automation.kind" />
            <Icon
              v-else
              icon="icon-[mdi--plus]"
              class="size-3.5"
            />
            创建
          </Button>
        </div>
      </div>
    </div>
  </SettingsSection>
</template>
