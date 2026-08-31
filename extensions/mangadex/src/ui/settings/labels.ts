import type { BadgeVariants } from '@kisaki3/extension-ui-vue'
import type { MangadexAutomationKind, MangadexAutomationStatus } from '../../shared/settings'
import { m } from './i18n'

export function getAutomationLabel(kind: MangadexAutomationKind): string {
  return m.value.automations.labels[kind]
}

export function getAutomationDescription(kind: MangadexAutomationKind): string {
  return m.value.automations.descriptions[kind]
}

export function getAutomationStatusLabel(status: MangadexAutomationStatus): string {
  return m.value.automations.status[status]
}

export const AUTOMATION_STATUS_VARIANTS: Record<
  MangadexAutomationStatus,
  BadgeVariants['variant']
> = {
  missing: 'secondary',
  enabled: 'success',
  disabled: 'warning'
}
