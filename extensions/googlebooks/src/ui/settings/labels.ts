import type { BadgeVariants } from '@kisaki3/extension-ui-vue'
import type { GbooksAutomationKind, GbooksAutomationStatus } from '../../shared/settings'
import { m } from './i18n'

export function getAutomationLabel(kind: GbooksAutomationKind): string {
  return m.value.automations.labels[kind]
}

export function getAutomationDescription(kind: GbooksAutomationKind): string {
  return m.value.automations.descriptions[kind]
}

export function getAutomationStatusLabel(status: GbooksAutomationStatus): string {
  return m.value.automations.status[status]
}

export const AUTOMATION_STATUS_VARIANTS: Record<GbooksAutomationStatus, BadgeVariants['variant']> =
  {
    missing: 'secondary',
    enabled: 'success',
    disabled: 'warning'
  }
