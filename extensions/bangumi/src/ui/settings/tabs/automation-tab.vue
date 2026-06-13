<!--
Automation Tab shows the state of the built-in Bangumi automations and
creates missing ones.
Boundary: renders `overview.automations`; creation goes through `host` RPC.
-->
<script setup lang="ts">
import { ref } from 'vue'
import {
  Badge,
  Button,
  Field,
  FieldContent,
  FieldGroup,
  type BadgeVariants
} from '@kisaki3/extension-ui-vue'
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

const STATUS_VARIANTS: Record<BangumiAutomationStatus, BadgeVariants['variant']> = {
  missing: 'secondary',
  enabled: 'success',
  disabled: 'warning'
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
  <FieldGroup>
    <Field
      v-for="automation in props.overview.automations"
      :key="automation.kind"
      orientation="horizontal"
      :label="AUTOMATION_LABELS[automation.kind]"
    >
      <FieldContent class="flex-row items-center gap-2">
        <Badge :variant="STATUS_VARIANTS[automation.status]">
          {{ STATUS_LABELS[automation.status] }}
        </Badge>
        <Button
          variant="outline"
          type="button"
          :disabled="automation.status !== 'missing' || creatingKind !== null"
          @click="create(automation.kind)"
        >
          创建
        </Button>
      </FieldContent>
    </Field>
  </FieldGroup>
</template>
