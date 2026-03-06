import type { ExistingReason, IngestWarning } from '@shared/ingest'

/**
 * Map ingest existing reasons to user-facing labels.
 */
export function getExistingReasonText(reason: ExistingReason | undefined): string {
  if (reason === 'externalId') return '外部 ID'
  if (reason === 'path') return '路径'
  return '未知原因'
}

/**
 * Summarize ingest post-commit warnings for toast notifications.
 */
export function getIngestWarningMessage(warnings: IngestWarning[] | undefined): string | undefined {
  if (!warnings?.length) return undefined
  if (warnings.length === 1) return warnings[0].message
  return `${warnings.length} 个资源后处理步骤失败，请查看日志。`
}
