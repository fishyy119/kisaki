import type { BadgeVariants } from '@kisaki3/extension-ui-vue'
import type { MalAutomationKind, MalAutomationStatus } from '../../shared/settings'
import { m } from './i18n'

export function getAutomationLabel(kind: MalAutomationKind): string {
  return m.value.automations.labels[kind]
}

export function getAutomationDescription(kind: MalAutomationKind): string {
  return m.value.automations.descriptions[kind]
}

export function getAutomationStatusLabel(status: MalAutomationStatus): string {
  return m.value.automations.status[status]
}

export const AUTOMATION_STATUS_VARIANTS: Record<MalAutomationStatus, BadgeVariants['variant']> = {
  missing: 'secondary',
  enabled: 'success',
  disabled: 'warning'
}
