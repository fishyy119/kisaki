import type { SerializableRecord } from '@kisaki/extension-sdk'
import { BangumiExtensionError, type BangumiErrorCode } from '../shared/errors'

export type BangumiJobStatus = 'completed' | 'cancelled' | 'failed'

export interface BangumiJobError extends SerializableRecord {
  subjectId: string | null
  gameId: string | null
  code: string
  message: string
}

export interface BangumiJobPreviewLink extends SerializableRecord {
  label: string
  href: string
}

export interface BangumiJobPreviewChange extends SerializableRecord {
  game: string
  bangumi: BangumiJobPreviewLink
  action: string
  local: string
  remote: string
}

export interface BangumiJobSummary extends SerializableRecord {
  version: 1
  commandId: string
  startedAt: number
  finishedAt: number
  status: BangumiJobStatus
  dryRun: boolean
  counters: Record<string, number>
  changes: readonly BangumiJobPreviewChange[]
  errors: readonly BangumiJobError[]
}

export interface BangumiJobSummaryInput {
  commandId: string
  startedAt: number
  status: BangumiJobStatus
  dryRun: boolean
  counters?: Record<string, number>
  changes?: readonly BangumiJobPreviewChange[]
  errors?: readonly BangumiJobError[]
}

export function createBangumiJobSummary(input: BangumiJobSummaryInput): BangumiJobSummary {
  return {
    version: 1,
    commandId: input.commandId,
    startedAt: input.startedAt,
    finishedAt: Date.now(),
    status: input.status,
    dryRun: input.dryRun,
    counters: normalizeCounters(input.counters),
    changes: (input.changes ?? []).map(normalizePreviewChange),
    errors: (input.errors ?? []).map(normalizeJobError)
  }
}

export function createJobError(
  error: unknown,
  context: Partial<BangumiJobError> = {}
): BangumiJobError {
  const base = toErrorShape(error)
  return normalizeJobError({
    ...context,
    code: base.code,
    message: base.message
  })
}

export function toDisplayError(error: unknown): {
  code: BangumiErrorCode | 'bangumi_error'
  message: string
} {
  if (error instanceof BangumiExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error && error.message.trim()) {
    return { code: 'bangumi_error', message: error.message.trim() }
  }

  return { code: 'bangumi_error', message: 'Bangumi job 执行失败。' }
}

export function isCancellationError(error: unknown): boolean {
  return (
    (error instanceof BangumiExtensionError && error.code === 'job_cancelled') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

function normalizeCounters(counters: Record<string, number> | undefined): Record<string, number> {
  const normalized: Record<string, number> = {}
  for (const [key, value] of Object.entries(counters ?? {})) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      normalized[key] = Math.max(0, Math.trunc(value))
    }
  }
  return normalized
}

function normalizeJobError(
  error: Partial<BangumiJobError> & { code: string; message: string }
): BangumiJobError {
  return {
    subjectId: error.subjectId || null,
    gameId: error.gameId || null,
    code: error.code || 'bangumi_error',
    message: error.message || 'Bangumi job 执行失败。'
  }
}

function normalizePreviewChange(change: BangumiJobPreviewChange): BangumiJobPreviewChange {
  return {
    game: normalizeText(change.game),
    bangumi: {
      label: normalizeText(change.bangumi.label),
      href: normalizeText(change.bangumi.href)
    },
    action: normalizeText(change.action),
    local: normalizeText(change.local),
    remote: normalizeText(change.remote)
  }
}

function normalizeText(value: string): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toErrorShape(error: unknown): { code: string; message: string } {
  if (error instanceof BangumiExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error && error.message.trim()) {
    return { code: 'bangumi_error', message: error.message.trim() }
  }

  return { code: 'bangumi_error', message: 'Bangumi job 执行失败。' }
}
