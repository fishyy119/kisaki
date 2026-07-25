import type { BadgeVariants } from '@renderer/components/ui/badge'
import type { ExtensionRepositoryInfo } from '@shared/extension'
import { formatters, messages } from '@renderer/core/i18n'

export function formatRepositoryDate(value: string | null): string {
  if (!value) {
    return messages.value.extension.repository.none
  }

  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return value
  }

  return formatters.value.dateTime(date)
}

export function formatRepositoryNullable(value: string | null): string {
  return value || messages.value.extension.repository.none
}

export function getRepositoryStateLabel(repository: ExtensionRepositoryInfo): string {
  return repository.state === 'enabled'
    ? messages.value.extension.repository.stateEnabled
    : messages.value.extension.repository.stateDisabled
}

export function getRepositoryStateVariant(
  repository: ExtensionRepositoryInfo
): BadgeVariants['variant'] {
  return repository.state === 'enabled' ? 'success' : 'secondary'
}

export function getRepositoryHealthLabel(repository: ExtensionRepositoryInfo): string {
  if (repository.state === 'disabled') {
    return messages.value.extension.repository.healthDisabled
  }
  if (repository.lastError) {
    return messages.value.extension.repository.healthError
  }
  if (!repository.lastSuccessAt) {
    return messages.value.extension.repository.healthNeverRefreshed
  }
  return messages.value.extension.repository.healthOk
}

export function getRepositoryHealthVariant(
  repository: ExtensionRepositoryInfo
): BadgeVariants['variant'] {
  if (repository.state === 'disabled') {
    return 'secondary'
  }
  if (repository.lastError) {
    return 'destructive'
  }
  if (!repository.lastSuccessAt) {
    return 'warning'
  }
  return 'success'
}

export function shouldShowRepositoryHealthBadge(repository: ExtensionRepositoryInfo): boolean {
  return (
    repository.state === 'disabled' || Boolean(repository.lastError) || !repository.lastSuccessAt
  )
}
