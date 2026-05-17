import {
  defineSettingsPanel,
  type EmptySettingsPanelDialogMap,
  type EmptySettingsPanelPopoverMap,
  type ExtensionErrorShape,
  type SettingsPanelField,
  type SettingsPanelNodeFactory,
  type SettingsPanelRootNodeEvents
} from '@kisaki/extension-sdk'
import { BangumiExtensionError } from '../shared/errors'
import type { AccountService, BangumiAccountSnapshotV1 } from '../auth/account'
import type { OAuthFlow } from '../auth/oauth-flow'
import type { TokenService, StoredTokenState } from '../auth/token-service'
import type { SettingsStore } from '../config/store'
import type { BangumiSettingsV1 } from '../config/schema'

type BangumiSettingsRootEvents = SettingsPanelRootNodeEvents<
  EmptySettingsPanelPopoverMap,
  EmptySettingsPanelDialogMap
>
type BangumiSettingsRootFactory = SettingsPanelNodeFactory<BangumiSettingsRootEvents>
type BangumiSettingsRootField = SettingsPanelField<BangumiSettingsRootEvents>

const NODE_IDS = {
  loginTimeoutMinutes: 'auth.loginTimeoutMinutes',
  autoSyncEnabled: 'autoSync.enabled',
  syncOnCreate: 'autoSync.syncOnCreate',
  playStatusEnabled: 'autoSync.playStatusEnabled',
  scoreEnabled: 'autoSync.scoreEnabled',
  clearRemoteScoreWhenEmpty: 'autoSync.clearRemoteScoreWhenEmpty',
  debounceSeconds: 'autoSync.debounceSeconds',
  autoSyncNotifyErrors: 'autoSync.notifyErrors',
  rateLimitMaxRequests: 'client.rateLimit.maxRequests',
  rateLimitWindowSeconds: 'client.rateLimit.windowSeconds',
  timeoutSeconds: 'client.timeoutSeconds',
  retryCount: 'client.retryCount'
} as const

interface BangumiSettingsPanelDependencies {
  settingsStore: SettingsStore
  accountService: AccountService
  oauthFlow: OAuthFlow
  tokenService: TokenService
}

export function createBangumiSettingsPanel({
  settingsStore,
  accountService,
  oauthFlow,
  tokenService
}: BangumiSettingsPanelDependencies) {
  return defineSettingsPanel({
    id: 'settings',
    title: 'Bangumi',
    async resolve(context, settings) {
      const [storedSettings, tokenState, account] = await Promise.all([
        settingsStore.get(),
        tokenService.getStoredTokenState(),
        accountService.getAccountSnapshot()
      ])
      const autoSyncEnabled = readBoolean(
        context.values,
        NODE_IDS.autoSyncEnabled,
        storedSettings.autoSync.enabled
      )
      const scoreSyncEnabled = readBoolean(
        context.values,
        NODE_IDS.scoreEnabled,
        storedSettings.autoSync.scoreEnabled
      )

      return {
        tabs: [
          {
            id: 'account',
            label: '账号',
            fields: createAccountFields({
              settings,
              tokenState,
              account,
              accountService,
              oauthFlow,
              tokenService
            })
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
                    initialValue: storedSettings.autoSync.enabled,
                    onCommit(event) {
                      return event.refresh('root')
                    }
                  })
                ]
              },
              {
                id: 'sync-on-create',
                label: '同步新增游戏',
                description: '新增带有 Bangumi Id 的本地游戏后，自动添加到 Bangumi 收藏。',
                disabled: !autoSyncEnabled,
                content: [
                  settings.checkbox({
                    id: NODE_IDS.syncOnCreate,
                    initialValue: storedSettings.autoSync.syncOnCreate
                  })
                ]
              },
              {
                id: 'play-status-sync',
                label: '同步游玩状态',
                description: '将本地游玩状态同步到 Bangumi 收藏状态。',
                disabled: !autoSyncEnabled,
                content: [
                  settings.checkbox({
                    id: NODE_IDS.playStatusEnabled,
                    initialValue: storedSettings.autoSync.playStatusEnabled
                  })
                ]
              },
              {
                id: 'score-sync',
                label: '同步评分',
                description: '将本地评分同步到 Bangumi 评分。',
                disabled: !autoSyncEnabled,
                content: [
                  settings.checkbox({
                    id: NODE_IDS.scoreEnabled,
                    initialValue: storedSettings.autoSync.scoreEnabled,
                    onCommit(event) {
                      return event.refresh('root')
                    }
                  })
                ]
              },
              {
                id: 'clear-remote-score',
                label: '允许删除远端评分',
                description: '本地评分为空时，删除 Bangumi 收藏中的评分。',
                disabled: !autoSyncEnabled || !scoreSyncEnabled,
                content: [
                  settings.checkbox({
                    id: NODE_IDS.clearRemoteScoreWhenEmpty,
                    initialValue: storedSettings.autoSync.clearRemoteScoreWhenEmpty
                  })
                ]
              },
              {
                id: 'debounce',
                label: '防抖时间（秒）',
                description: '本地变化后延迟一小段时间再同步，避免连续编辑触发多次请求。',
                disabled: !autoSyncEnabled,
                content: [
                  settings.numberInput({
                    id: NODE_IDS.debounceSeconds,
                    initialValue: storedSettings.autoSync.debounceMs / 1000,
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

function createAccountFields({
  settings,
  tokenState,
  account,
  accountService,
  oauthFlow,
  tokenService
}: {
  settings: BangumiSettingsRootFactory
  tokenState: StoredTokenState
  account: BangumiAccountSnapshotV1 | undefined
  accountService: AccountService
  oauthFlow: OAuthFlow
  tokenService: TokenService
}): BangumiSettingsRootField[] {
  const isLoggedIn = tokenState.hasToken && !!account

  return [
    {
      id: 'account-status',
      label: 'Bangumi 账号',
      content: [
        settings.text({
          id: 'account-summary',
          text: formatAccountSummary(account, tokenState),
          tone: 'default'
        })
      ]
    },
    {
      id: 'account-token-expires-at',
      label: '过期时间',
      hidden: !tokenState.hasToken,
      content: [
        settings.text({
          id: 'token-expires-at',
          text: formatTokenExpiresAt(tokenState),
          tone: tokenState.expired ? 'danger' : 'default'
        })
      ]
    },
    {
      id: 'account-actions',
      label: '操作',
      orientation: 'horizontal',
      contentLayout: 'inline',
      content: [
        settings.button({
          id: 'bangumi-login',
          label: '登录',
          tone: 'primary',
          hidden: isLoggedIn,
          async onClick(event) {
            try {
              await oauthFlow.startLogin(event.signal)
              return event.success({
                message: '已打开系统浏览器，请完成 Bangumi 授权。',
                refresh: 'root'
              })
            } catch (error) {
              return event.fail(toSettingsError(error), { refresh: 'root' })
            }
          }
        }),
        settings.button({
          id: 'bangumi-verify-account',
          label: '验证账号',
          disabled: !tokenState.hasToken,
          async onClick(event) {
            try {
              const verification = await accountService.verifyAccount(event.signal)
              return event.success({
                message: `Bangumi 账号有效：${verification.account.nickname}`,
                refresh: 'root'
              })
            } catch (error) {
              return event.fail(toSettingsError(error), { refresh: 'root' })
            }
          }
        }),
        settings.button({
          id: 'bangumi-refresh-token',
          label: '刷新凭据',
          disabled: !tokenState.hasRefreshToken,
          async onClick(event) {
            try {
              await tokenService.refreshAccessToken({ forceRefresh: true, signal: event.signal })
              const refreshedAccount = await accountService.refreshAccount(event.signal)
              return event.success({
                message: `Bangumi 凭据已刷新：${refreshedAccount.nickname}`,
                refresh: 'root'
              })
            } catch (error) {
              return event.fail(toSettingsError(error), { refresh: 'root' })
            }
          }
        }),
        settings.button({
          id: 'bangumi-logout',
          label: '退出',
          tone: 'danger',
          disabled: !tokenState.hasToken && !account,
          async onClick(event) {
            try {
              await accountService.logout()
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
    }
  ]
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
    autoSync: {
      ...current.autoSync,
      enabled: readBoolean(values, NODE_IDS.autoSyncEnabled, current.autoSync.enabled),
      syncOnCreate: readBoolean(values, NODE_IDS.syncOnCreate, current.autoSync.syncOnCreate),
      playStatusEnabled: readBoolean(
        values,
        NODE_IDS.playStatusEnabled,
        current.autoSync.playStatusEnabled
      ),
      scoreEnabled: readBoolean(values, NODE_IDS.scoreEnabled, current.autoSync.scoreEnabled),
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

function readNumber(values: Record<string, unknown>, key: string, fallback: number): number {
  const value = values[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readBoolean(values: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = values[key]
  return typeof value === 'boolean' ? value : fallback
}

function toSettingsError(error: unknown): ExtensionErrorShape {
  if (error instanceof BangumiExtensionError) {
    return {
      code: error.code,
      message: error.message
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return {
      code: 'bangumi_error',
      message: error.message.trim()
    }
  }

  return {
    code: 'bangumi_error',
    message: 'Bangumi 操作失败，请稍后重试。'
  }
}

function formatAccountSummary(
  account: BangumiAccountSnapshotV1 | undefined,
  tokenState: StoredTokenState
): string {
  if (!tokenState.hasToken || !account) {
    return '未登录'
  }

  return `${account.nickname} (@${account.username})`
}

function formatTokenExpiresAt(tokenState: StoredTokenState): string {
  return formatDateTime(tokenState.expiresAt) ?? '未知'
}

function formatDateTime(value: number | null | undefined): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false
  })
}
