<!--
Advanced Tab edits client/network settings and hosts destructive maintenance
actions (clear sync state, reset settings) behind confirmation prompts.
Boundary: binds the shared settings form; actions go through `host` RPC.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { settingsForm } from '../form'
import { host, toErrorMessage } from '../rpc'

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'error', message: string): void
}>()

const busyAction = ref<string | null>(null)

async function runDangerAction(
  action: string,
  confirmText: string,
  run: () => Promise<void>
): Promise<void> {
  if (busyAction.value || !window.confirm(confirmText)) {
    return
  }

  busyAction.value = action
  try {
    await run()
    emit('refresh')
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    busyAction.value = null
  }
}

function logout(): void {
  void runDangerAction('logout', '确定要清除 Bangumi 凭据吗？', () => host.logout())
}

function clearSyncState(): void {
  void runDangerAction('clear-sync', '确定要清除同步状态与变更队列吗？', () =>
    host.clearSyncState()
  )
}

function resetSettings(): void {
  void runDangerAction('reset', '确定要恢复默认设置吗？', () => host.resetSettings())
}
</script>

<template>
  <section>
    <div class="field">
      <div class="field-info">
        <span class="field-label">登录超时（分钟）</span>
      </div>
      <div class="field-control">
        <input
          v-model.number="settingsForm.loginTimeoutMinutes"
          type="number"
          min="1"
          max="60"
        />
      </div>
    </div>

    <div class="field">
      <div class="field-info">
        <span class="field-label">API 请求数上限</span>
        <span class="field-hint">速率限制窗口内允许的请求数。</span>
      </div>
      <div class="field-control">
        <input
          v-model.number="settingsForm.rateLimitMaxRequests"
          type="number"
          min="1"
          max="10000"
        />
      </div>
    </div>

    <div class="field">
      <div class="field-info">
        <span class="field-label">API 时间窗口（秒）</span>
      </div>
      <div class="field-control">
        <input
          v-model.number="settingsForm.rateLimitWindowSeconds"
          type="number"
          min="1"
          max="3600"
        />
      </div>
    </div>

    <div class="field">
      <div class="field-info">
        <span class="field-label">API 超时（秒）</span>
      </div>
      <div class="field-control">
        <input
          v-model.number="settingsForm.timeoutSeconds"
          type="number"
          min="1"
          max="120"
        />
      </div>
    </div>

    <div class="field">
      <div class="field-info">
        <span class="field-label">重试次数</span>
      </div>
      <div class="field-control">
        <input
          v-model.number="settingsForm.retryCount"
          type="number"
          min="0"
          max="10"
        />
      </div>
    </div>

    <div class="field">
      <div class="field-info">
        <span class="field-label">自动同步防抖（秒）</span>
      </div>
      <div class="field-control">
        <input
          v-model.number="settingsForm.debounceSeconds"
          type="number"
          min="0.25"
          max="60"
          step="0.25"
        />
      </div>
    </div>

    <div class="field">
      <div class="field-info">
        <span class="field-label">同步错误通知</span>
      </div>
      <div class="field-control">
        <input
          v-model="settingsForm.notifyErrors"
          type="checkbox"
          :disabled="!settingsForm.autoSyncEnabled"
        />
      </div>
    </div>

    <div class="field">
      <div class="field-info">
        <span class="field-label">危险操作</span>
        <span class="field-hint">这些操作立即生效且不可撤销。</span>
      </div>
      <div class="field-control">
        <button
          type="button"
          class="border-transparent bg-danger text-primary-foreground"
          :disabled="busyAction !== null"
          @click="logout"
        >
          清除凭据
        </button>
        <button
          type="button"
          class="border-transparent bg-danger text-primary-foreground"
          :disabled="busyAction !== null"
          @click="clearSyncState"
        >
          清除同步状态
        </button>
        <button
          type="button"
          class="border-transparent bg-danger text-primary-foreground"
          :disabled="busyAction !== null"
          @click="resetSettings"
        >
          恢复默认设置
        </button>
      </div>
    </div>
  </section>
</template>
