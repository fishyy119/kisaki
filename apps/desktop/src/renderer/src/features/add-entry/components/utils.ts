import type { ExistingReason, IngestWarning } from '@shared/ingest'
import { messages } from '@renderer/core/i18n'

/**
 * Map ingest existing reasons to user-facing labels.
 */
export function getExistingReasonText(reason: ExistingReason | undefined): string {
  if (reason === 'externalId') return messages.value.addEntry.existingReasonExternalId
  if (reason === 'path') return messages.value.addEntry.existingReasonPath
  return messages.value.addEntry.existingReasonUnknown
}

/**
 * Summarize ingest post-commit warnings for toast notifications.
 */
export function getIngestWarningMessage(warnings: IngestWarning[] | undefined): string | undefined {
  if (!warnings?.length) return undefined
  if (warnings.length === 1) return warnings[0]!.message
  return messages.value.addEntry.postProcessWarnings({ count: warnings.length })
}
