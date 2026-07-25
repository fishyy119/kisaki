import type { BadgeVariants } from '@kisaki3/extension-ui-vue'
import type { BangumiAutomationKind, BangumiAutomationStatus } from '../../shared/settings'
import { m } from './i18n'

export function getAutomationLabel(kind: BangumiAutomationKind): string {
  return m.value.automations.labels[kind]
}

export function getAutomationDescription(kind: BangumiAutomationKind): string {
  return m.value.automations.descriptions[kind]
}

export function getAutomationStatusLabel(status: BangumiAutomationStatus): string {
  return m.value.automations.status[status]
}

export const AUTOMATION_STATUS_VARIANTS: Record<BangumiAutomationStatus, BadgeVariants['variant']> =
  {
    missing: 'secondary',
    enabled: 'success',
    disabled: 'warning'
  }
