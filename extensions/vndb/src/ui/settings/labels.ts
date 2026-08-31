import type { BadgeVariants } from '@kisaki3/extension-ui-vue'
import type { VndbAutomationKind, VndbAutomationStatus } from '../../shared/settings'
import { m } from './i18n'

export function getAutomationLabel(kind: VndbAutomationKind): string {
  return m.value.automations.labels[kind]
}

export function getAutomationDescription(kind: VndbAutomationKind): string {
  return m.value.automations.descriptions[kind]
}

export function getAutomationStatusLabel(status: VndbAutomationStatus): string {
  return m.value.automations.status[status]
}

export const AUTOMATION_STATUS_VARIANTS: Record<VndbAutomationStatus, BadgeVariants['variant']> = {
  missing: 'secondary',
  enabled: 'success',
  disabled: 'warning'
}
