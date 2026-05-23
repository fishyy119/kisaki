import type { SerializableRecord } from '@kisaki3/extension-sdk'
import { BangumiExtensionError, type BangumiErrorCode } from '../shared/errors'

export type BangumiJobStatus = 'completed' | 'cancelled' | 'failed'

export interface BangumiJobError extends SerializableRecord {
  scope: string | null
  subjectId: string | null
  localId: string | null
  code: string
  message: string
}

export interface BangumiJobPreviewLink extends SerializableRecord {
  label: string
  href: string
}

export type BangumiJobPreviewTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface BangumiJobPreviewBadge extends SerializableRecord {
  label: string
  tone: BangumiJobPreviewTone
}

export interface BangumiJobPreviewRow extends SerializableRecord {
  label: string
  before: string
  after: string
  tone: BangumiJobPreviewTone
}

export interface BangumiJobPreviewGroup extends SerializableRecord {
  id: string
  title: string
  link: BangumiJobPreviewLink
  badges: readonly BangumiJobPreviewBadge[]
  rows: readonly BangumiJobPreviewRow[]
}

export interface BangumiJobSummary extends SerializableRecord {
  version: 1
  commandId: string
  startedAt: number
  finishedAt: number
  status: BangumiJobStatus
  dryRun: boolean
  counters: Record<string, number>
  previewGroups: readonly BangumiJobPreviewGroup[]
  errors: readonly BangumiJobError[]
}

export interface BangumiJobSummaryInput {
  commandId: string
  startedAt: number
  status: BangumiJobStatus
  dryRun: boolean
  counters?: Record<string, number>
  previewGroups?: readonly BangumiJobPreviewGroup[]
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
    previewGroups: (input.previewGroups ?? []).map(normalizePreviewGroup),
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
    scope: error.scope || null,
    subjectId: error.subjectId || null,
    localId: error.localId || null,
    code: error.code || 'bangumi_error',
    message: error.message || 'Bangumi job 执行失败。'
  }
}

function normalizePreviewGroup(group: BangumiJobPreviewGroup): BangumiJobPreviewGroup {
  return {
    id: normalizeText(group.id),
    title: normalizeText(group.title),
    link: {
      label: normalizeText(group.link.label),
      href: normalizeText(group.link.href)
    },
    badges: group.badges.map((badge) => ({
      label: normalizeText(badge.label),
      tone: badge.tone
    })),
    rows: group.rows.map((row) => ({
      label: normalizeText(row.label),
      before: normalizeText(row.before),
      after: normalizeText(row.after),
      tone: row.tone
    }))
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
