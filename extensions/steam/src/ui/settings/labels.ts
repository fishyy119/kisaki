import type { BadgeVariants } from '@kisaki3/extension-ui-vue'
import type { SteamAutomationKind, SteamAutomationStatus } from '../../shared/settings'
import { m } from './i18n'

export function getAutomationLabel(kind: SteamAutomationKind): string {
  return m.value.automations.labels[kind]
}

export function getAutomationDescription(kind: SteamAutomationKind): string {
  return m.value.automations.descriptions[kind]
}

export function getAutomationStatusLabel(status: SteamAutomationStatus): string {
  return m.value.automations.status[status]
}

export const AUTOMATION_STATUS_VARIANTS: Record<SteamAutomationStatus, BadgeVariants['variant']> = {
  missing: 'secondary',
  enabled: 'success',
  disabled: 'warning'
}
