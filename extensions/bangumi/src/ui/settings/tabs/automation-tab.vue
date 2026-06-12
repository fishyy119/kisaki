<script setup lang="ts">
import { ref } from 'vue'
import type {
  BangumiAutomationKind,
  BangumiAutomationStatus,
  BangumiSettingsOverview
} from '../../../shared/settings'
import { host, toErrorMessage } from '../rpc'

interface Props {
  overview: BangumiSettingsOverview
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'error', message: string): void
}>()

const AUTOMATION_LABELS: Record<BangumiAutomationKind, string> = {
  'auth-refresh': '启动时刷新凭据',
  'sync-changed': '启动后同步变更队列',
  'sync-full-daily': '每日全量同步'
}

const STATUS_LABELS: Record<BangumiAutomationStatus, string> = {
  missing: '未创建',
  enabled: '已创建',
  disabled: '已停用'
}

const STATUS_CLASSES: Record<BangumiAutomationStatus, string> = {
  missing: 'text-muted-foreground',
  enabled: 'text-accent',
  disabled: 'text-danger'
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
  <section>
    <div
      v-for="automation in props.overview.automations"
      :key="automation.kind"
      class="field"
    >
      <div class="field-info">
        <span class="field-label">{{ AUTOMATION_LABELS[automation.kind] }}</span>
      </div>
      <div class="field-control">
        <span
          class="text-xs"
          :class="STATUS_CLASSES[automation.status]"
        >
          {{ STATUS_LABELS[automation.status] }}
        </span>
        <button
          type="button"
          class="border-transparent bg-primary text-primary-foreground"
          :disabled="automation.status !== 'missing' || creatingKind !== null"
          @click="create(automation.kind)"
        >
          创建
        </button>
      </div>
    </div>
  </section>
</template>
