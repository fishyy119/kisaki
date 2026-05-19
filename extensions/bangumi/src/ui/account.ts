import type { AccountService, BangumiAccountSnapshotV1 } from '../auth/account'
import type { OAuthFlow } from '../auth/oauth-flow'
import type { StoredTokenState } from '../auth/token-service'
import {
  type ActiveJobRegistry,
  BANGUMI_COMMAND_IDS,
  createActiveJobField,
  formatDateTime,
  maybeField,
  startRootManualJob
} from './common/jobs'
import { toSettingsError } from './common/errors'
import type {
  BangumiSettingsRootFactory,
  BangumiSettingsRootField,
  ResolvedActiveJob
} from './common/types'

export function createAccountFields({
  settings,
  tokenState,
  account,
  accountService,
  oauthFlow,
  activeJobRegistry,
  activeRefreshJob
}: {
  settings: BangumiSettingsRootFactory
  tokenState: StoredTokenState
  account: BangumiAccountSnapshotV1 | undefined
  accountService: AccountService
  oauthFlow: OAuthFlow
  activeJobRegistry: ActiveJobRegistry
  activeRefreshJob?: ResolvedActiveJob
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
          disabled: !tokenState.hasRefreshToken || !!activeRefreshJob?.progress,
          async onClick(event) {
            try {
              return await startRootManualJob({
                scope: 'account.refresh',
                commandId: BANGUMI_COMMAND_IDS.authRefresh,
                args: {
                  forceRefresh: true,
                  verifyAccount: true
                },
                argsSummary: '刷新并验证账号',
                activeJobRegistry,
                event
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
    },
    ...maybeField(
      createActiveJobField({
        settings,
        id: 'account-refresh-job',
        label: '刷新任务',
        scope: 'account.refresh',
        activeJob: activeRefreshJob,
        activeJobRegistry
      })
    )
  ]
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
