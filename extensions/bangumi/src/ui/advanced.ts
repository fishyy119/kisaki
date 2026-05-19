import type { BangumiSettingsV1 } from '../config/schema'
import type { SettingsStore } from '../config/store'
import { createAutoSyncFlags, readAutoSyncItems } from './sync/options'
import { NODE_IDS } from './common/constants'
import { toSettingsError } from './common/errors'
import { readBoolean, readNumber } from './common/values'
import type { BangumiSettingsRootFactory, BangumiSettingsRootField } from './common/types'

export function createAdvancedFields({
  settings,
  storedSettings,
  settingsStore,
  autoSyncEnabled
}: {
  settings: BangumiSettingsRootFactory
  storedSettings: BangumiSettingsV1
  settingsStore: SettingsStore
  autoSyncEnabled: boolean
}): BangumiSettingsRootField[] {
  return [
    {
      id: 'login-timeout',
      label: '登录超时（分钟）',
      description: '从打开浏览器授权到完成登录的等待时间',
      content: [
        settings.numberInput({
          id: NODE_IDS.loginTimeoutMinutes,
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
        settings.numberInput({
          id: NODE_IDS.rateLimitMaxRequests,
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
        settings.numberInput({
          id: NODE_IDS.rateLimitWindowSeconds,
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
        settings.numberInput({
          id: NODE_IDS.timeoutSeconds,
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
        settings.numberInput({
          id: NODE_IDS.retryCount,
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
        settings.numberInput({
          id: NODE_IDS.debounceSeconds,
          initialValue: storedSettings.autoSync.debounceMs / 1000,
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
        settings.switch({
          id: NODE_IDS.autoSyncNotifyErrors,
          initialValue: storedSettings.autoSync.notifyErrors
        })
      ]
    },
    {
      id: 'restore-defaults',
      label: '恢复默认设置',
      content: [
        settings.button({
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
              await settingsStore.reset()
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
}

export function readSettingsForm(
  values: Record<string, unknown>,
  current: BangumiSettingsV1
): BangumiSettingsV1 {
  const autoSyncFlags = createAutoSyncFlags(readAutoSyncItems(values, current))

  return {
    version: 1,
    auth: {
      loginTimeoutMs:
        readNumber(values, NODE_IDS.loginTimeoutMinutes, current.auth.loginTimeoutMs / 60_000) *
        60_000
    },
    autoSync: {
      ...current.autoSync,
      enabled: readBoolean(values, NODE_IDS.autoSyncEnabled, current.autoSync.enabled),
      ...autoSyncFlags,
      clearRemoteScoreWhenEmpty: readBoolean(
        values,
        NODE_IDS.clearRemoteScoreWhenEmpty,
        current.autoSync.clearRemoteScoreWhenEmpty
      ),
      debounceMs:
        readNumber(values, NODE_IDS.debounceSeconds, current.autoSync.debounceMs / 1000) * 1000,
      notifyErrors: readBoolean(
        values,
        NODE_IDS.autoSyncNotifyErrors,
        current.autoSync.notifyErrors
      )
    },
    client: {
      rateLimit: {
        maxRequests: readNumber(
          values,
          NODE_IDS.rateLimitMaxRequests,
          current.client.rateLimit.maxRequests
        ),
        windowMs:
          readNumber(
            values,
            NODE_IDS.rateLimitWindowSeconds,
            current.client.rateLimit.windowMs / 1000
          ) * 1000
      },
      timeoutMs:
        readNumber(values, NODE_IDS.timeoutSeconds, current.client.timeoutMs / 1000) * 1000,
      retryCount: readNumber(values, NODE_IDS.retryCount, current.client.retryCount)
    }
  }
}
