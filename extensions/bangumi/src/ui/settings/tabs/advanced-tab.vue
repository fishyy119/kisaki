<!--
Advanced Tab edits client/network settings and hosts destructive maintenance
actions (clear sync state, reset settings) behind a confirmation dialog.
Boundary: binds the shared settings form; actions go through `host` RPC.
-->
<script setup lang="ts">
import { ref } from 'vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Field,
  FieldContent,
  FieldGroup,
  Input,
  Switch
} from '@kisaki3/extension-ui-vue'
import { settingsForm } from '../form'
import { host, toErrorMessage } from '../rpc'

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'error', message: string): void
}>()

interface DangerAction {
  title: string
  description: string
  run: () => Promise<void>
}

const DANGER_ACTIONS: readonly { key: string; label: string; action: DangerAction }[] = [
  {
    key: 'logout',
    label: '清除凭据',
    action: {
      title: '清除 Bangumi 凭据',
      description: '将退出当前账号并删除已保存的访问令牌。',
      run: () => host.logout()
    }
  },
  {
    key: 'clear-sync',
    label: '清除同步状态',
    action: {
      title: '清除同步状态',
      description: '将清空同步指纹与变更队列，下次同步会重新比对全部条目。',
      run: () => host.clearSyncState()
    }
  },
  {
    key: 'reset',
    label: '恢复默认设置',
    action: {
      title: '恢复默认设置',
      description: '将把全部 Bangumi 设置重置为默认值。',
      run: () => host.resetSettings()
    }
  }
]

const busy = ref(false)
const confirmOpen = ref(false)
const pendingAction = ref<DangerAction | null>(null)

function requestAction(action: DangerAction): void {
  pendingAction.value = action
  confirmOpen.value = true
}

async function confirmAction(): Promise<void> {
  const action = pendingAction.value
  if (!action || busy.value) {
    return
  }

  busy.value = true
  try {
    await action.run()
    confirmOpen.value = false
    emit('refresh')
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <FieldGroup>
    <Field
      orientation="horizontal"
      label="登录超时（分钟）"
    >
      <Input
        v-model.number="settingsForm.loginTimeoutMinutes"
        type="number"
        min="1"
        max="60"
        class="w-24"
      />
    </Field>

    <Field
      orientation="horizontal"
      label="API 请求数上限"
      description="速率限制窗口内允许的请求数。"
    >
      <Input
        v-model.number="settingsForm.rateLimitMaxRequests"
        type="number"
        min="1"
        max="10000"
        class="w-24"
      />
    </Field>

    <Field
      orientation="horizontal"
      label="API 时间窗口（秒）"
    >
      <Input
        v-model.number="settingsForm.rateLimitWindowSeconds"
        type="number"
        min="1"
        max="3600"
        class="w-24"
      />
    </Field>

    <Field
      orientation="horizontal"
      label="API 超时（秒）"
    >
      <Input
        v-model.number="settingsForm.timeoutSeconds"
        type="number"
        min="1"
        max="120"
        class="w-24"
      />
    </Field>

    <Field
      orientation="horizontal"
      label="重试次数"
    >
      <Input
        v-model.number="settingsForm.retryCount"
        type="number"
        min="0"
        max="10"
        class="w-24"
      />
    </Field>

    <Field
      orientation="horizontal"
      label="自动同步防抖（秒）"
    >
      <Input
        v-model.number="settingsForm.debounceSeconds"
        type="number"
        min="0.25"
        max="60"
        step="0.25"
        class="w-24"
      />
    </Field>

    <Field
      orientation="horizontal"
      label="同步错误通知"
    >
      <Switch
        v-model="settingsForm.notifyErrors"
        :disabled="!settingsForm.autoSyncEnabled"
      />
    </Field>

    <Field
      orientation="horizontal"
      label="危险操作"
      description="这些操作立即生效且不可撤销。"
    >
      <FieldContent class="flex-row items-center gap-2">
        <Button
          v-for="entry in DANGER_ACTIONS"
          :key="entry.key"
          variant="destructive"
          type="button"
          :disabled="busy"
          @click="requestAction(entry.action)"
        >
          {{ entry.label }}
        </Button>
      </FieldContent>
    </Field>
  </FieldGroup>

  <AlertDialog v-model:open="confirmOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ pendingAction?.title }}</AlertDialogTitle>
      </AlertDialogHeader>
      <AlertDialogDescription>
        {{ pendingAction?.description }}
      </AlertDialogDescription>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="busy">取消</AlertDialogCancel>
        <AlertDialogAction
          :disabled="busy"
          @click="confirmAction"
        >
          确认执行
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
