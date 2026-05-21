import { defineSettingsPanelTab } from '@kisaki/extension-sdk'
import type { BangumiAccountSnapshotV1 } from '../../../auth/account'
import type { StoredTokenState } from '../../../auth/token-service'
import type { BangumiSettingsRootScope, BangumiSettingsTab } from '../contracts'
import { toSettingsError } from '../shared/errors'
import { BANGUMI_COMMAND_IDS, formatDateTime, startRootManualJob } from '../shared/jobs'

export async function resolveAccountTab(
  scope: BangumiSettingsRootScope
): Promise<BangumiSettingsTab> {
  const [tokenState, account, activeJobs] = await Promise.all([
    scope.resources.tokenState(),
    scope.resources.account(),
    scope.resources.activeJobs()
  ])
  const { ui, runtime } = scope
  const isLoggedIn = tokenState.hasToken && !!account

  return defineSettingsPanelTab({
    id: 'account',
    label: '账号',
    fields: [
      {
        id: 'account-status',
        label: 'Bangumi 账号',
        content: [
          ui.text({
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
          ui.text({
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
          ui.button({
            id: 'bangumi-login',
            label: '登录',
            tone: 'primary',
            hidden: isLoggedIn,
            async onClick(event) {
              try {
                await runtime.oauthFlow.startLogin(event.signal)
                return event.success({
                  message: '已打开系统浏览器，请完成 Bangumi 授权。',
                  refresh: 'root'
                })
              } catch (error) {
                return event.fail(toSettingsError(error), { refresh: 'root' })
              }
            }
          }),
          ui.button({
            id: 'bangumi-verify-account',
            label: '验证账号',
            disabled: !tokenState.hasToken,
            async onClick(event) {
              try {
                const verification = await runtime.accountService.verifyAccount(event.signal)
                return event.success({
                  message: `Bangumi 账号有效：${verification.account.nickname}`,
                  refresh: 'root'
                })
              } catch (error) {
                return event.fail(toSettingsError(error), { refresh: 'root' })
              }
            }
          }),
          ui.button({
            id: 'bangumi-refresh-token',
            label: '刷新凭据',
            disabled: !tokenState.hasRefreshToken || activeJobs.accountRefresh,
            async onClick(event) {
              try {
                return await startRootManualJob({
                  commandId: BANGUMI_COMMAND_IDS.authRefresh,
                  args: {
                    forceRefresh: true,
                    verifyAccount: true
                  },
                  event
                })
              } catch (error) {
                return event.fail(toSettingsError(error), { refresh: 'root' })
              }
            }
          }),
          ui.button({
            id: 'bangumi-logout',
            label: '退出',
            tone: 'danger',
            disabled: !tokenState.hasToken && !account,
            async onClick(event) {
              try {
                await runtime.accountService.logout()
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
  })
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
