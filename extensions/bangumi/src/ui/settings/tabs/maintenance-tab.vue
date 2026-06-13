<!-- Maintenance Tab edits advanced client preferences and destructive local maintenance. -->
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
  Icon,
  Input,
  Switch
} from '@kisaki3/extension-ui-vue'
import { settingsForm } from '../form'
import { host, toErrorMessage } from '../rpc'
import SettingsSection from '../components/settings-section.vue'

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

interface DangerAction {
  title: string
  description: string
  run: () => Promise<void>
}

const DANGER_ACTIONS: readonly { key: string; label: string; action: DangerAction }[] = [
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
      description: '将把 Bangumi 偏好设置重置为默认值，不会退出账号或删除自动化。',
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
  <div class="space-y-4">
    <SettingsSection
      title="网络与客户端"
      description="这些偏好保存后影响后续 Bangumi API 请求。"
      surface="rows"
    >
      <FieldGroup>
        <Field
          orientation="horizontal"
          label="登录超时"
        >
          <FieldContent class="flex-row items-center gap-2">
            <Input
              v-model.number="settingsForm.loginTimeoutMinutes"
              type="number"
              min="1"
              max="60"
              class="w-20"
            />
            <span class="text-xs text-muted-foreground">分钟</span>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          label="API 速率限制"
          description="请求数 / 时间窗口。"
        >
          <FieldContent class="flex-row items-center gap-2">
            <Input
              v-model.number="settingsForm.rateLimitMaxRequests"
              type="number"
              min="1"
              max="10000"
              class="w-20"
            />
            <span class="text-xs text-muted-foreground">/</span>
            <Input
              v-model.number="settingsForm.rateLimitWindowSeconds"
              type="number"
              min="1"
              max="3600"
              class="w-20"
            />
            <span class="text-xs text-muted-foreground">秒</span>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          label="API 超时"
        >
          <FieldContent class="flex-row items-center gap-2">
            <Input
              v-model.number="settingsForm.timeoutSeconds"
              type="number"
              min="1"
              max="120"
              class="w-20"
            />
            <span class="text-xs text-muted-foreground">秒</span>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          label="重试次数"
        >
          <FieldContent class="flex-row items-center gap-2">
            <Input
              v-model.number="settingsForm.retryCount"
              type="number"
              min="0"
              max="10"
              class="w-20"
            />
            <span class="text-xs text-muted-foreground">次</span>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          label="自动同步防抖"
        >
          <FieldContent class="flex-row items-center gap-2">
            <Input
              v-model.number="settingsForm.debounceSeconds"
              type="number"
              min="0.25"
              max="60"
              step="0.25"
              class="w-20"
            />
            <span class="text-xs text-muted-foreground">秒</span>
          </FieldContent>
        </Field>

        <Field
          orientation="horizontal"
          label="同步错误通知"
          description="同步任务失败时发送主应用通知。"
        >
          <Switch v-model="settingsForm.notifyErrors" />
        </Field>
      </FieldGroup>
    </SettingsSection>

    <SettingsSection
      title="维护操作"
      description="这些操作立即生效且不可撤销。"
    >
      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-for="entry in DANGER_ACTIONS"
          :key="entry.key"
          variant="destructive"
          size="sm"
          type="button"
          :disabled="busy"
          @click="requestAction(entry.action)"
        >
          <Icon
            icon="icon-[mdi--alert-outline]"
            class="size-3.5"
          />
          {{ entry.label }}
        </Button>
      </div>
    </SettingsSection>

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
  </div>
</template>
