import type { BadgeVariants } from '@kisaki3/extension-ui-vue'
import type { NeodbAutomationKind, NeodbAutomationStatus } from '../../shared/settings'
import { m } from './i18n'

export function getAutomationLabel(kind: NeodbAutomationKind): string {
  return m.value.automations.labels[kind]
}

export function getAutomationDescription(kind: NeodbAutomationKind): string {
  return m.value.automations.descriptions[kind]
}

export function getAutomationStatusLabel(status: NeodbAutomationStatus): string {
  return m.value.automations.status[status]
}

export const AUTOMATION_STATUS_VARIANTS: Record<NeodbAutomationStatus, BadgeVariants['variant']> =
  {
    missing: 'secondary',
    enabled: 'success',
    disabled: 'warning'
  }
