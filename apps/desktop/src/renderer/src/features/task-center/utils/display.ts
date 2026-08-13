import type {
  TaskRun,
  TaskRunCategory,
  TaskRunFinalStatus,
  TaskRunOperation,
  TaskRunRatePeriod,
  TaskRunProgressUnit,
  TaskRunStatus
} from '@shared/task-run'
import type { BadgeVariants } from '@renderer/components/ui/badge'
import type { Messages } from '@shared/i18n'
import { formatters, messages } from '@renderer/core/i18n'
import { formatBytes } from '@renderer/utils/format'

export const TASK_RUN_CATEGORY_OPTIONS: readonly TaskRunCategory[] = [
  'scanner',
  'ingest',
  'extension',
  'updater',
  'system'
]

export const TASK_RUN_COMPLETED_STATUS_OPTIONS: readonly TaskRunFinalStatus[] = [
  'completed',
  'failed',
  'cancelled'
]

export const TASK_RUN_ACTIVE_STATUS_OPTIONS: readonly TaskRunStatus[] = [
  'queued',
  'running',
  'pausing',
  'paused',
  'cancelling'
]

// Counter keys with aliases collapsing onto the canonical catalog labels.
const COUNTER_KEY_ALIASES: Record<string, keyof Messages['task']['counters']> = {
  total: 'total',
  processed: 'processed',
  succeeded: 'succeeded',
  success: 'succeeded',
  failed: 'failed',
  skipped: 'skipped',
  warnings: 'warnings',
  warning: 'warnings',
  added: 'added',
  new: 'added',
  existing: 'existing',
  updated: 'updated',
  deleted: 'deleted',
  changed: 'changed',
  notModified: 'notModified'
}

export function formatTaskRunCategory(category: TaskRunCategory): string {
  return messages.value.task.categories[category]
}

export function getTaskRunCategoryIcon(category: TaskRunCategory): string {
  switch (category) {
    case 'scanner':
      return 'icon-[mdi--folder-search-outline]'
    case 'ingest':
      return 'icon-[mdi--database-import-outline]'
    case 'extension':
      return 'icon-[mdi--puzzle-outline]'
    case 'updater':
      return 'icon-[mdi--update]'
    case 'system':
      return 'icon-[mdi--cog-sync-outline]'
  }
}

export function formatTaskRunOperation(operation: TaskRunOperation): string {
  const ops = messages.value.task.operations
  switch (operation) {
    case 'scanner.scan':
      return ops.scan
    case 'extension.package.install':
      return ops.installExtension
    case 'extension.package.update':
      return ops.updateExtension
    case 'extension.package.import':
      return ops.importExtensionPackage
    case 'extension.package.uninstall':
      return ops.uninstallExtension
    case 'extension.repository.refresh':
      return ops.refreshRepository
    case 'extension.repository.refreshAll':
      return ops.refreshAllRepositories
    case 'updater.check':
      return ops.checkUpdates
    case 'updater.download':
      return ops.downloadUpdate
    case 'system.maintenance':
      return ops.systemMaintenance
    default:
      break
  }

  if (operation.startsWith('ingest.')) {
    return formatIngestOperation(operation)
  }

  if (operation.startsWith('extension.task.')) {
    return ops.extensionTask
  }

  return operation
}

export function formatTaskRunStatus(status: TaskRunStatus): string {
  return messages.value.task.statuses[status]
}

export function getTaskRunStatusVariant(status: TaskRunStatus): BadgeVariants['variant'] {
  switch (status) {
    case 'running':
      return 'default'
    case 'completed':
      return 'success'
    case 'pausing':
    case 'paused':
    case 'cancelling':
      return 'warning'
    case 'failed':
      return 'destructive'
    case 'queued':
    case 'cancelled':
      return 'secondary'
  }
}

export function formatTaskRunOwner(run: TaskRun): string {
  if (run.owner.type === 'app') {
    return messages.value.task.owner.app
  }

  return messages.value.task.owner.extension({
    name: run.owner.extension.nameSnapshot ?? run.owner.extension.id
  })
}

export function formatTaskRunInitiator(run: TaskRun): string {
  const initiator = messages.value.task.initiator
  switch (run.initiator.type) {
    case 'user':
      return initiator.user
    case 'automation':
      return initiator.automation({ name: run.initiator.automation.nameSnapshot })
    case 'extension':
      return initiator.extension({
        name: run.initiator.extension.nameSnapshot ?? run.initiator.extension.id
      })
    case 'system':
      return run.initiator.reason
        ? initiator.systemWithReason({ reason: formatSystemReason(run.initiator.reason) })
        : initiator.system
  }
}

export function formatTaskRunSubject(run: TaskRun): string {
  if (!run.subject) {
    return '-'
  }

  const label = messages.value.task.subjects[run.subject.type]
  const value = run.subject.labelSnapshot ?? run.subject.id
  return value ? messages.value.task.subjectValue({ label, value }) : label
}

export function formatTaskRunPhase(run: TaskRun): string {
  const phase = run.progress?.phase
  if (phase) {
    const prefix = formatPhasePosition(phase.current, phase.total)
    return prefix ? `${prefix} · ${phase.label}` : phase.label
  }

  return formatTaskRunOperation(run.operation)
}

export function formatTaskRunResultSummary(run: TaskRun): string {
  if (run.result?.error) {
    return run.result.error
  }

  if (run.result?.summary) {
    return run.result.summary
  }

  if (run.result?.title) {
    return run.result.title
  }

  const counters = formatTaskRunCounterSummary(run, run.result?.counters, 3)
  return counters ?? messages.value.task.details.noResultSummary
}

export function formatProgressCount(run: TaskRun): string | null {
  const work = run.progress?.work
  if (!work) return null

  if (typeof work.current === 'number' && typeof work.total === 'number') {
    return `${formatProgressValue(work.current, work.unit)} / ${formatProgressValue(
      work.total,
      work.unit
    )}`
  }

  if (typeof work.current === 'number') {
    return formatProgressValue(work.current, work.unit)
  }

  return null
}

export function formatProgressPercent(run: TaskRun): string | null {
  const percent = getProgressPercentValue(run)
  if (percent === null) {
    return null
  }

  return `${Math.max(0, Math.min(100, percent)).toFixed(percent >= 10 ? 0 : 1)}%`
}

export function getProgressPercentValue(run: TaskRun): number | null {
  const percent = run.progress?.work?.percent
  if (typeof percent === 'number' && Number.isFinite(percent)) {
    return Math.max(0, Math.min(100, percent))
  }

  const current = run.progress?.work?.current
  const total = run.progress?.work?.total
  if (
    typeof current === 'number' &&
    typeof total === 'number' &&
    Number.isFinite(current) &&
    Number.isFinite(total) &&
    total > 0
  ) {
    return Math.max(0, Math.min(100, (current / total) * 100))
  }

  return null
}

export function formatTaskRunRate(run: TaskRun): string | null {
  const work = run.progress?.work
  const rate = work?.rate
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    return null
  }

  if (work?.unit === 'byte') {
    const period = work.ratePeriod ?? selectRatePeriod(rate)
    return `${formatBytes(rate * getRatePeriodMultiplier(period))}/${formatRatePeriod(period)}`
  }

  const unit = work?.unit ? formatProgressUnit(work.unit) : messages.value.task.progressUnits.item
  const period = work?.ratePeriod ?? selectRatePeriod(rate)
  return `${formatRateNumber(rate * getRatePeriodMultiplier(period))} ${unit}/${formatRatePeriod(
    period
  )}`
}

export function formatTaskRunEta(run: TaskRun): string | null {
  const etaMs = run.progress?.work?.etaMs
  if (typeof etaMs !== 'number' || !Number.isFinite(etaMs) || etaMs <= 0) {
    return null
  }

  return messages.value.task.progress.etaAbout({ duration: formatDurationShort(etaMs) })
}

export function formatTaskRunDuration(run: TaskRun, now = Date.now()): string {
  const start = run.startedAt ?? run.createdAt
  const end = run.finishedAt ?? now
  return formatDurationShort(Math.max(0, end - start))
}

export function formatTimestamp(timestamp: number | undefined): string {
  if (timestamp === undefined) {
    return '-'
  }

  return formatters.value.dateTime(new Date(timestamp))
}

export function formatCounterKey(key: string): string {
  const canonical = COUNTER_KEY_ALIASES[key]
  return canonical ? messages.value.task.counters[canonical] : key
}

export function getTaskRunCounterEntries(
  counters: Record<string, number> | undefined
): [string, number][] {
  if (!counters) return []

  return Object.entries(counters)
    .filter(([, value]) => Number.isFinite(value))
    .sort(([left], [right]) => counterPriority(left) - counterPriority(right))
}

export function formatTaskRunCounterSummary(
  run: TaskRun,
  counters: Record<string, number> | undefined,
  limit = 4
): string | null {
  const entries = getTaskRunCounterEntries(counters).slice(0, limit)

  if (entries.length === 0) return null
  return entries
    .map(([key, value]) => `${formatCounterKey(key)} ${formatTaskRunCounterValue(run, key, value)}`)
    .join(' / ')
}

export function formatTaskRunCounterValue(run: TaskRun, key: string, value: number): string {
  if (run.progress?.work?.unit === 'byte' && isByteCounterKey(key)) {
    return formatBytes(value)
  }

  return formatNumber(value)
}

export function formatJsonPreview(value: unknown, maxChars: number): string {
  let text: string
  try {
    text = JSON.stringify(value, null, 2)
  } catch {
    text = String(value)
  }

  if (text.length <= maxChars) {
    return text
  }

  return `${text.slice(0, maxChars)}\n...`
}

export function getTaskRunSearchText(run: TaskRun): string {
  return [
    run.id,
    run.title,
    run.description,
    run.category,
    formatTaskRunCategory(run.category),
    run.operation,
    formatTaskRunOperation(run.operation),
    run.progress?.phase?.label,
    formatTaskRunOwner(run),
    formatTaskRunInitiator(run),
    formatTaskRunSubject(run),
    run.subject?.id,
    run.subject?.labelSnapshot
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function matchesTaskRunSearch(run: TaskRun, search: string): boolean {
  const query = search.trim().toLowerCase()
  if (!query) return true
  return getTaskRunSearchText(run).includes(query)
}

function formatIngestOperation(operation: TaskRunOperation): string {
  const ops = messages.value.task.operations
  const [, entity, action] = operation.split('.')
  const label = formatIngestEntity(entity)
  switch (action) {
    case 'add':
      return ops.ingestAdd({ label })
    case 'update':
      return ops.ingestUpdate({ label })
    case 'batchAdd':
      return ops.ingestBatchAdd({ label })
    case 'batchUpdate':
      return ops.ingestBatchUpdate({ label })
    case 'batchDelete':
      return ops.ingestBatchDelete({ label })
    default:
      return operation
  }
}

function formatIngestEntity(entity: string | undefined): string {
  switch (entity) {
    case 'game':
    case 'anime':
    case 'person':
    case 'company':
    case 'character':
      return messages.value.task.subjects[entity]
    default:
      return messages.value.task.operations.ingestFallbackEntity
  }
}

function formatSystemReason(reason: string): string {
  switch (reason) {
    case 'startup':
    case 'maintenance':
    case 'update':
    case 'shutdown':
      return messages.value.task.systemReasons[reason]
    default:
      return reason
  }
}

function formatPhasePosition(
  current: number | undefined,
  total: number | undefined
): string | null {
  if (typeof current === 'number' && typeof total === 'number') {
    return `${formatNumber(current)}/${formatNumber(total)}`
  }

  return null
}

function formatProgressValue(value: number, unit: TaskRunProgressUnit | undefined): string {
  if (unit === 'byte') {
    return formatBytes(value)
  }

  return formatNumber(value)
}

function formatProgressUnit(unit: TaskRunProgressUnit): string {
  return messages.value.task.progressUnits[unit]
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0'
  }

  if (Math.abs(value) >= 10) {
    return formatters.value.number(Math.round(value))
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatRateNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0'
  }

  if (Math.abs(value) >= 10) {
    return formatters.value.number(Math.round(value))
  }

  if (Math.abs(value) >= 1) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
  }

  return value.toFixed(2)
}

function selectRatePeriod(ratePerSecond: number): TaskRunRatePeriod {
  if (ratePerSecond >= 1) {
    return 'second'
  }

  if (ratePerSecond * 60 >= 0.1) {
    return 'minute'
  }

  return 'hour'
}

function getRatePeriodMultiplier(period: TaskRunRatePeriod): number {
  switch (period) {
    case 'second':
      return 1
    case 'minute':
      return 60
    case 'hour':
      return 3600
  }
}

function formatRatePeriod(period: TaskRunRatePeriod): string {
  return messages.value.task.ratePeriods[period]
}

function formatDurationShort(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return formatters.value.durationFine(0)
  }

  return formatters.value.durationFine(Math.max(1000, ms))
}

function counterPriority(key: string): number {
  switch (key) {
    case 'total':
      return 0
    case 'processed':
      return 1
    case 'succeeded':
    case 'success':
      return 2
    case 'failed':
      return 3
    case 'skipped':
      return 4
    case 'added':
    case 'new':
      return 5
    case 'existing':
      return 6
    case 'updated':
      return 7
    case 'deleted':
      return 8
    case 'notModified':
      return 9
    case 'warnings':
    case 'warning':
      return 10
    default:
      return 20
  }
}

function isByteCounterKey(key: string): boolean {
  switch (key) {
    case 'total':
    case 'processed':
    case 'succeeded':
    case 'success':
    case 'failed':
    case 'skipped':
    case 'added':
    case 'updated':
    case 'deleted':
      return true
    default:
      return false
  }
}
