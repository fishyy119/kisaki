import type { JsonObject } from '@kisaki3/extension-sdk'
import type { BangumiJobPreviewGroup } from '../../shared/settings'
import { BangumiExtensionError, type BangumiErrorCode } from '../utils/errors'
import { m } from '../i18n'

export interface BangumiJobError extends JsonObject {
  scope: string | null
  subjectId: string | null
  localId: string | null
  code: string
  message: string
}

export interface BangumiJobSummary extends JsonObject {
  version: 1
  commandId: string
  startedAt: number
  finishedAt: number
  counters: Record<string, number>
  previewGroups: readonly BangumiJobPreviewGroup[]
  errors: readonly BangumiJobError[]
}

export interface BangumiJobSummaryInput {
  commandId: string
  startedAt: number
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

  return { code: 'bangumi_error', message: m().errors.jobFailed }
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
    message: error.message || m().errors.jobFailed
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

  return { code: 'bangumi_error', message: m().errors.jobFailed }
}
