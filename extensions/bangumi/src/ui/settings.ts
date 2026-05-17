import { defineSettingsPanel } from '@kisaki/extension-sdk'
import type { TokenStore } from '../auth/token-store'
import type { SettingsStore } from '../config/store'
import type { BangumiSettingsV1, BangumiUnmappedStrategy } from '../config/schema'

const NODE_IDS = {
  loginTimeoutMinutes: 'auth.loginTimeoutMinutes',
  autoSyncEnabled: 'sync.autoSyncEnabled',
  syncOnCreate: 'sync.syncOnCreate',
  playStatusEnabled: 'sync.playStatusEnabled',
  scoreEnabled: 'sync.scoreEnabled',
  clearRemoteScoreWhenEmpty: 'sync.clearRemoteScoreWhenEmpty',
  unmappedStrategy: 'sync.unmappedStrategy',
  debounceSeconds: 'sync.debounceSeconds',
  rateLimitMaxRequests: 'client.rateLimit.maxRequests',
  rateLimitWindowSeconds: 'client.rateLimit.windowSeconds',
  timeoutSeconds: 'client.timeoutSeconds',
  retryCount: 'client.retryCount',
  notifySyncErrors: 'diagnostics.notifySyncErrors'
} as const

interface BangumiSettingsPanelDependencies {
  settingsStore: SettingsStore
  tokenStore: TokenStore
}

export function createBangumiSettingsPanel({
  settingsStore,
  tokenStore
}: BangumiSettingsPanelDependencies) {
  return defineSettingsPanel({
    id: 'settings',
    title: 'Bangumi',
    async resolve(_context, settings) {
      const [storedSettings, hasToken] = await Promise.all([
        settingsStore.get(),
        tokenStore.hasToken()
      ])

      return {
        tabs: [
          {
            id: 'account',
            label: '账号',
            fields: [
              {
                id: 'account-status',
                label: 'Bangumi 账号',
                content: [
                  settings.status({
                    id: 'token-status',
                    tone: hasToken ? 'success' : 'neutral',
                    label: '凭据',
                    value: hasToken ? '已保存' : '未登录'
                  })
                ]
              }
            ]
          },
          {
            id: 'sync',
            label: '同步',
            fields: [
              {
                id: 'auto-sync',
                label: '自动同步',
                description: '本地游玩状态或评分变化后，自动写入 Bangumi 收藏。',
                content: [
                  settings.switch({
                    id: NODE_IDS.autoSyncEnabled,
                    initialValue: storedSettings.sync.autoSyncEnabled
                  })
                ]
              },
              {
                id: 'sync-on-create',
                label: '新建游戏时同步',
                description: '从 Bangumi 刮削创建本地游戏后，立即建立对应收藏同步。',
                content: [
                  settings.checkbox({
                    id: NODE_IDS.syncOnCreate,
                    initialValue: storedSettings.sync.syncOnCreate
                  })
                ]
              },
              {
                id: 'play-status-sync',
                label: '同步游玩状态',
                description: '将本地游玩状态同步为 Bangumi 收藏状态。',
                content: [
                  settings.checkbox({
                    id: NODE_IDS.playStatusEnabled,
                    initialValue: storedSettings.sync.playStatusEnabled
                  })
                ]
              },
              {
                id: 'score-sync',
                label: '同步评分',
                description: '将本地 1-10 评分同步到 Bangumi 评分。',
                content: [
                  settings.checkbox({
                    id: NODE_IDS.scoreEnabled,
                    initialValue: storedSettings.sync.scoreEnabled
                  })
                ]
              },
              {
                id: 'clear-remote-score',
                label: '空评分清除远端评分',
                description: '本地评分为空时，把 Bangumi 评分清为 0。',
                content: [
                  settings.checkbox({
                    id: NODE_IDS.clearRemoteScoreWhenEmpty,
                    initialValue: storedSettings.sync.clearRemoteScoreWhenEmpty
                  })
                ]
              },
              {
                id: 'unmapped-strategy',
                label: '未绑定游戏',
                description: '本地游戏没有 Bangumi ID 时，自动同步如何处理。',
                content: [
                  settings.select({
                    id: NODE_IDS.unmappedStrategy,
                    initialValue: storedSettings.sync.unmappedStrategy,
                    options: [
                      { value: 'skip', label: '跳过' },
                      { value: 'notify', label: '通知' },
                      { value: 'resolveWithProfile', label: '使用 Profile 解析' }
                    ]
                  })
                ]
              },
              {
                id: 'debounce',
                label: '防抖时间（秒）',
                description: '本地变化后延迟一小段时间再同步，避免连续编辑触发多次请求。',
                content: [
                  settings.numberInput({
                    id: NODE_IDS.debounceSeconds,
                    initialValue: storedSettings.sync.debounceMs / 1000,
                    min: 0.25,
                    max: 60,
                    step: 0.25
                  })
                ]
              }
            ]
          },
          {
            id: 'advanced',
            label: '高级',
            fields: [
              {
                id: 'login-timeout',
                label: '登录超时（分钟）',
                description: '从打开浏览器授权到完成登录的等待时间。',
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
                description: '同一时间窗口内最多允许发起的 Bangumi API 请求。',
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
                description: '请求数统计窗口。默认是每 60 秒最多 120 次请求。',
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
                description: '单次 Bangumi API 请求等待响应的最长时间。',
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
                description: '遇到限流、网络错误或临时服务错误时的最多重试次数。',
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
                id: 'notify-sync-errors',
                label: '同步错误通知',
                description: '自动同步失败时显示桌面通知。',
                content: [
                  settings.switch({
                    id: NODE_IDS.notifySyncErrors,
                    initialValue: storedSettings.diagnostics.notifySyncErrors
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
                    async onClick(event) {
                      await settingsStore.reset()
                      return event.success({
                        message: 'Bangumi 设置已恢复默认值。',
                        refresh: 'root'
                      })
                    }
                  })
                ]
              }
            ]
          }
        ]
      }
    },
    async submit(event) {
      const current = await settingsStore.get()
      await settingsStore.set(readSettingsForm(event.values, current))
      return event.success({ message: 'Bangumi 设置已保存。', refresh: 'root' })
    }
  })
}

function readSettingsForm(
  values: Record<string, unknown>,
  current: BangumiSettingsV1
): BangumiSettingsV1 {
  return {
    version: 1,
    auth: {
      loginTimeoutMs:
        readNumber(values, NODE_IDS.loginTimeoutMinutes, current.auth.loginTimeoutMs / 60_000) *
        60_000
    },
    sync: {
      ...current.sync,
      autoSyncEnabled: readBoolean(values, NODE_IDS.autoSyncEnabled, current.sync.autoSyncEnabled),
      syncOnCreate: readBoolean(values, NODE_IDS.syncOnCreate, current.sync.syncOnCreate),
      playStatusEnabled: readBoolean(
        values,
        NODE_IDS.playStatusEnabled,
        current.sync.playStatusEnabled
      ),
      scoreEnabled: readBoolean(values, NODE_IDS.scoreEnabled, current.sync.scoreEnabled),
      clearRemoteScoreWhenEmpty: readBoolean(
        values,
        NODE_IDS.clearRemoteScoreWhenEmpty,
        current.sync.clearRemoteScoreWhenEmpty
      ),
      unmappedStrategy: readUnmappedStrategy(
        values,
        NODE_IDS.unmappedStrategy,
        current.sync.unmappedStrategy
      ),
      debounceMs:
        readNumber(values, NODE_IDS.debounceSeconds, current.sync.debounceMs / 1000) * 1000
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
    },
    diagnostics: {
      notifySyncErrors: readBoolean(
        values,
        NODE_IDS.notifySyncErrors,
        current.diagnostics.notifySyncErrors
      )
    }
  }
}

function readNumber(values: Record<string, unknown>, key: string, fallback: number): number {
  const value = values[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readBoolean(values: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = values[key]
  return typeof value === 'boolean' ? value : fallback
}

function readUnmappedStrategy(
  values: Record<string, unknown>,
  key: string,
  fallback: BangumiUnmappedStrategy
): BangumiUnmappedStrategy {
  const value = values[key]

  if (value === 'skip' || value === 'notify' || value === 'resolveWithProfile') {
    return value
  }

  return fallback
}
