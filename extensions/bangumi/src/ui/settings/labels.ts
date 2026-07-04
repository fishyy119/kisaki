import type { BadgeVariants } from '@kisaki3/extension-ui-vue'
import type { BangumiAutomationKind, BangumiAutomationStatus } from '../../shared/settings'

export const AUTOMATION_LABELS: Record<BangumiAutomationKind, string> = {
  'auth-refresh': '启动时刷新凭据',
  'sync-changed': '启动后同步变更队列',
  'sync-full-daily': '每日全量同步'
}

export const AUTOMATION_STATUS_LABELS: Record<BangumiAutomationStatus, string> = {
  missing: '未创建',
  enabled: '已启用',
  disabled: '已停用'
}

export const AUTOMATION_STATUS_VARIANTS: Record<BangumiAutomationStatus, BadgeVariants['variant']> =
  {
    missing: 'secondary',
    enabled: 'success',
    disabled: 'warning'
  }
