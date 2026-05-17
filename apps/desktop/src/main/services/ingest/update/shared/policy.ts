import type { IngestUpdatePolicy } from '@shared/ingest/update'
import { normalizeOptionalString } from './normalization'

export function normalizePolicy(
  policy: Partial<IngestUpdatePolicy> | undefined
): IngestUpdatePolicy {
  return {
    singularUpdate: policy?.singularUpdate === 'overwrite' ? 'overwrite' : 'ifMissing',
    collectionUpdate: policy?.collectionUpdate === 'replace' ? 'replace' : 'merge'
  }
}

export function isMissingValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}

export function shouldApplyScalarUpdate(
  currentValue: unknown,
  incomingValue: unknown,
  policy: IngestUpdatePolicy['singularUpdate']
): boolean {
  if (isMissingValue(incomingValue)) return false
  if (policy === 'overwrite') return true
  return isMissingValue(currentValue)
}

export function shouldApplyMediaUpdate(
  currentFile: string | null | undefined,
  incomingUrl: string | undefined,
  policy: IngestUpdatePolicy['singularUpdate']
): boolean {
  if (!incomingUrl) return false
  if (policy === 'overwrite') return true
  return !normalizeOptionalString(currentFile)
}
