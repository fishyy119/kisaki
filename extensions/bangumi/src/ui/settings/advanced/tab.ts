import { defineSettingsPanelTab } from '@kisaki3/extension-sdk'
import type { BangumiSettingsRootScope, BangumiSettingsTab } from '../contracts'
import { SETTINGS_NODE_IDS } from '../ids'
import { toSettingsError } from '../shared/errors'
import { readBoolean } from '../shared/values'

export async function resolveAdvancedTab(
  scope: BangumiSettingsRootScope
): Promise<BangumiSettingsTab> {
  const storedSettings = await scope.resources.settings()
  const autoSyncEnabled = readBoolean(
    scope.context.values,
    SETTINGS_NODE_IDS.autoSyncEnabled,
    storedSettings.game.autoSync.enabled
  )

  return defineSettingsPanelTab({
    id: 'advanced',
    label: '高级',
    fields: [
      {
        id: 'login-timeout',
        label: '登录超时（分钟）',
        description: '从打开浏览器授权到完成登录的等待时间',
        content: [
          scope.ui.numberInput({
            id: SETTINGS_NODE_IDS.loginTimeoutMinutes,
            initialValue: storedSettings.auth.loginTimeoutMs / 60_000,
            min: 1,
            max: 60,
            step: 1
          })
        ]
      },
      {
        id: 'rate-limit-max-requests',
        label: 'API 请求数',
        description: '同一时间窗口内最多允许发起的 Bangumi API 请求',
        content: [
          scope.ui.numberInput({
            id: SETTINGS_NODE_IDS.rateLimitMaxRequests,
            initialValue: storedSettings.client.rateLimit.maxRequests,
            min: 1,
            max: 10_000,
            step: 1
          })
        ]
      },
      {
        id: 'rate-limit-window',
        label: 'API 时间窗口（秒）',
        description: '请求数统计窗口，默认是每 60 秒最多 120 次请求',
        content: [
          scope.ui.numberInput({
            id: SETTINGS_NODE_IDS.rateLimitWindowSeconds,
            initialValue: storedSettings.client.rateLimit.windowMs / 1000,
            min: 1,
            max: 3600,
            step: 1
          })
        ]
      },
      {
        id: 'timeout',
        label: 'API 超时（秒）',
        description: '单次 Bangumi API 请求等待响应的最长时间',
        content: [
          scope.ui.numberInput({
            id: SETTINGS_NODE_IDS.timeoutSeconds,
            initialValue: storedSettings.client.timeoutMs / 1000,
            min: 1,
            max: 120,
            step: 1
          })
        ]
      },
      {
        id: 'retry-count',
        label: '重试次数',
        description: '遇到限流、网络错误或临时服务错误时的最多重试次数',
        content: [
          scope.ui.numberInput({
            id: SETTINGS_NODE_IDS.retryCount,
            initialValue: storedSettings.client.retryCount,
            min: 0,
            max: 10,
            step: 1
          })
        ]
      },
      {
        id: 'debounce',
        label: '自动同步防抖时间（秒）',
        description: '本地变化后延迟一小段时间再同步，避免连续编辑触发多次请求',
        content: [
          scope.ui.numberInput({
            id: SETTINGS_NODE_IDS.debounceSeconds,
            initialValue: storedSettings.game.autoSync.debounceMs / 1000,
            min: 0.25,
            max: 60,
            step: 0.25
          })
        ]
      },
      {
        id: 'notify-sync-errors',
        label: '同步错误通知',
        description: '自动同步失败时显示桌面通知',
        disabled: !autoSyncEnabled,
        content: [
          scope.ui.switch({
            id: SETTINGS_NODE_IDS.autoSyncNotifyErrors,
            initialValue: storedSettings.game.autoSync.notifyErrors
          })
        ]
      },
      {
        id: 'clear-credentials',
        label: '清除凭据',
        description: '删除 Bangumi token、登录会话和账号摘要，不影响设置、同步状态或自动化',
        content: [
          scope.ui.button({
            id: 'clear-credentials',
            label: '清除 Bangumi 凭据',
            tone: 'danger',
            confirm: {
              title: '清除 Bangumi 凭据',
              description: '这会退出当前 Bangumi 登录，并删除本机保存的 Bangumi 凭据。',
              confirmLabel: '清除 Bangumi 凭据',
              cancelLabel: '取消'
            },
            async onClick(event) {
              try {
                await scope.runtime.accountService.logout()
                return event.success({
                  message: 'Bangumi 凭据已清除。',
                  refresh: 'root'
                })
              } catch (error) {
                return event.fail(toSettingsError(error), { refresh: 'root' })
              }
            }
          })
        ]
      },
      {
        id: 'clear-sync-state',
        label: '清除同步状态',
        description: '删除同步 fingerprint 和待同步队列，不删除主应用自动化或历史记录',
        content: [
          scope.ui.button({
            id: 'clear-sync-state',
            label: '清除同步状态',
            tone: 'danger',
            confirm: {
              title: '清除同步状态',
              description: '这会清空 Bangumi 自动同步状态和待同步变更队列。',
              confirmLabel: '清除同步状态',
              cancelLabel: '取消'
            },
            async onClick(event) {
              try {
                await Promise.all([
                  scope.runtime.syncStateStore.clear(),
                  scope.runtime.syncQueueStore.clear()
                ])
                return event.success({
                  message: 'Bangumi 同步状态已清除。',
                  refresh: 'root'
                })
              } catch (error) {
                return event.fail(toSettingsError(error), { refresh: 'root' })
              }
            }
          })
        ]
      },
      {
        id: 'restore-defaults',
        label: '恢复默认设置',
        description: '只重置设置，不删除 token、同步状态或自动化',
        content: [
          scope.ui.button({
            id: 'restore-defaults',
            label: '恢复默认设置',
            tone: 'danger',
            confirm: {
              title: '恢复默认设置',
              description: '这会将 Bangumi 扩展设置恢复为默认值，当前改动会被覆盖。',
              confirmLabel: '恢复默认设置',
              cancelLabel: '取消'
            },
            async onClick(event) {
              try {
                await scope.runtime.settingsStore.reset()
                return event.success({
                  message: 'Bangumi 设置已恢复默认值。',
                  refresh: 'root'
                })
              } catch (error) {
                return event.fail(toSettingsError(error), { refresh: 'root' })
              }
            }
          })
        ]
      }
    ]
  })
}
