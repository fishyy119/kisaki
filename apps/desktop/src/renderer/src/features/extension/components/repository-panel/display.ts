import type { BadgeVariants } from '@renderer/components/ui/badge'
import type { ExtensionRepositoryInfo } from '@shared/extension'

export function formatRepositoryDate(value: string | null): string {
  if (!value) {
    return '无'
  }

  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return value
  }

  return date.toLocaleString()
}

export function formatRepositoryNullable(value: string | null): string {
  return value || '无'
}

export function getRepositoryStateLabel(repository: ExtensionRepositoryInfo): string {
  return repository.state === 'enabled' ? '已启用' : '已禁用'
}

export function getRepositoryStateVariant(
  repository: ExtensionRepositoryInfo
): BadgeVariants['variant'] {
  return repository.state === 'enabled' ? 'success' : 'secondary'
}

export function getRepositoryHealthLabel(repository: ExtensionRepositoryInfo): string {
  if (repository.state === 'disabled') {
    return '已禁用'
  }
  if (repository.lastError) {
    return '异常'
  }
  if (!repository.lastSuccessAt) {
    return '未刷新'
  }
  return '正常'
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
