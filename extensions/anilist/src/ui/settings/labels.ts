import type { BadgeVariants } from '@kisaki3/extension-ui-vue'
import type { AnilistAutomationKind, AnilistAutomationStatus } from '../../shared/settings'
import { m } from './i18n'

export function getAutomationLabel(kind: AnilistAutomationKind): string {
  return m.value.automations.labels[kind]
}

export function getAutomationDescription(kind: AnilistAutomationKind): string {
  return m.value.automations.descriptions[kind]
}

export function getAutomationStatusLabel(status: AnilistAutomationStatus): string {
  return m.value.automations.status[status]
}

export const AUTOMATION_STATUS_VARIANTS: Record<AnilistAutomationStatus, BadgeVariants['variant']> =
  {
    missing: 'secondary',
    enabled: 'success',
    disabled: 'warning'
  }
