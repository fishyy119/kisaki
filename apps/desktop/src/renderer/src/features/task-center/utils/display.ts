import type {
  TaskRun,
  TaskRunCategory,
  TaskRunFinalStatus,
  TaskRunOperation,
  TaskRunRatePeriod,
  TaskRunProgressUnit,
  TaskRunStatus,
  TaskRunSubjectType
} from '@shared/task-run'
import type { BadgeVariants } from '@renderer/components/ui/badge'

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

const COUNTER_LABELS: Record<string, string> = {
  total: '总数',
  processed: '已处理',
  succeeded: '成功',
  success: '成功',
  failed: '失败',
  skipped: '跳过',
  warnings: '警告',
  warning: '警告',
  added: '新增',
  new: '新增',
  existing: '已存在',
  updated: '更新',
  deleted: '删除',
  notModified: '未变化'
}

const SUBJECT_LABELS: Record<TaskRunSubjectType, string> = {
  command: '命令',
  automation: '自动化',
  scanner: '扫描器',
  game: '游戏',
  person: '人物',
  company: '公司',
  character: '角色',
  extension: '扩展',
  repository: '仓库',
  app: '应用'
}

export function formatTaskRunCategory(category: TaskRunCategory): string {
  switch (category) {
    case 'scanner':
      return '扫描'
    case 'ingest':
      return '导入'
    case 'extension':
      return '扩展'
    case 'updater':
      return '更新'
    case 'system':
      return '系统'
  }
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
  switch (operation) {
    case 'scanner.scan':
      return '扫描媒体'
    case 'extension.package.install':
      return '安装扩展'
    case 'extension.package.update':
      return '更新扩展'
    case 'extension.package.import':
      return '导入扩展包'
    case 'extension.package.uninstall':
      return '卸载扩展'
    case 'extension.repository.refresh':
      return '刷新扩展仓库'
    case 'extension.repository.refreshAll':
      return '刷新全部扩展仓库'
    case 'updater.check':
      return '检查软件更新'
    case 'updater.download':
      return '下载软件更新'
    case 'system.maintenance':
      return '系统维护'
    default:
      break
  }

  if (operation.startsWith('ingest.')) {
    return formatIngestOperation(operation)
  }

  if (operation.startsWith('extension.task.')) {
    return '扩展任务'
  }

  return operation
}

export function formatTaskRunStatus(status: TaskRunStatus): string {
  switch (status) {
    case 'queued':
      return '排队中'
    case 'running':
      return '运行中'
    case 'pausing':
      return '暂停中'
    case 'paused':
      return '已暂停'
    case 'cancelling':
      return '取消中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    case 'cancelled':
      return '已取消'
  }
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
    return '应用'
  }

  return `扩展：${run.owner.extension.nameSnapshot ?? run.owner.extension.id}`
}

export function formatTaskRunInitiator(run: TaskRun): string {
  switch (run.initiator.type) {
    case 'user':
      return '用户'
    case 'automation':
      return `自动化：${run.initiator.automation.nameSnapshot}`
    case 'extension':
      return `扩展：${run.initiator.extension.nameSnapshot ?? run.initiator.extension.id}`
    case 'system':
      return run.initiator.reason ? `系统：${formatSystemReason(run.initiator.reason)}` : '系统'
  }
}

export function formatTaskRunSubject(run: TaskRun): string {
  if (!run.subject) {
    return '-'
  }

  const label = SUBJECT_LABELS[run.subject.type]
  const value = run.subject.labelSnapshot ?? run.subject.id
  return value ? `${label}：${value}` : label
}

export function formatTaskRunPhase(run: TaskRun): string {
  if (run.progress?.message) {
    return run.progress.message
  }

  if (run.progress?.phase) {
    return run.progress.phase
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
  return counters ?? '无结果摘要'
}

export function formatProgressCount(run: TaskRun): string | null {
  const progress = run.progress
  if (!progress) return null

  if (typeof progress.current === 'number' && typeof progress.total === 'number') {
    return `${formatProgressValue(progress.current, progress.unit)} / ${formatProgressValue(
      progress.total,
      progress.unit
    )}`
  }

  if (typeof progress.current === 'number') {
    return formatProgressValue(progress.current, progress.unit)
  }

  return null
}

export function formatProgressPercent(run: TaskRun): string | null {
  const percent = run.progress?.percent
  if (typeof percent !== 'number' || !Number.isFinite(percent)) {
    return null
  }

  return `${Math.max(0, Math.min(100, percent)).toFixed(percent >= 10 ? 0 : 1)}%`
}

export function getProgressPercentValue(run: TaskRun): number | null {
  const percent = run.progress?.percent
  if (typeof percent === 'number' && Number.isFinite(percent)) {
    return Math.max(0, Math.min(100, percent))
  }

  const current = run.progress?.current
  const total = run.progress?.total
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
  const rate = run.progress?.rate
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    return null
  }

  if (run.progress?.unit === 'byte') {
    const period = run.progress.ratePeriod ?? selectRatePeriod(rate)
    return `${formatBytes(rate * getRatePeriodMultiplier(period))}/${formatRatePeriod(period)}`
  }

  const unit = run.progress?.unit ? formatProgressUnit(run.progress.unit) : '项'
  const period = run.progress?.ratePeriod ?? selectRatePeriod(rate)
  return `${formatRateNumber(rate * getRatePeriodMultiplier(period))} ${unit}/${formatRatePeriod(
    period
  )}`
}

export function formatTaskRunEta(run: TaskRun): string | null {
  const etaMs = run.progress?.etaMs
  if (typeof etaMs !== 'number' || !Number.isFinite(etaMs) || etaMs <= 0) {
    return null
  }

  return `约 ${formatDurationShort(etaMs)}`
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

  return new Date(timestamp).toLocaleString('zh-Hans', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function formatCounterKey(key: string): string {
  return COUNTER_LABELS[key] ?? key
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
  if (run.progress?.unit === 'byte' && isByteCounterKey(key)) {
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
  const [, entity, action] = operation.split('.')
  const entityLabel = formatIngestEntity(entity)
  switch (action) {
    case 'add':
      return `添加${entityLabel}`
    case 'update':
      return `更新${entityLabel}`
    case 'batchAdd':
      return `批量添加${entityLabel}`
    case 'batchUpdate':
      return `批量更新${entityLabel}`
    case 'batchDelete':
      return `批量删除${entityLabel}`
    default:
      return operation
  }
}

function formatIngestEntity(entity: string | undefined): string {
  switch (entity) {
    case 'game':
      return '游戏'
    case 'person':
      return '人物'
    case 'company':
      return '公司'
    case 'character':
      return '角色'
    default:
      return '条目'
  }
}

function formatSystemReason(reason: string): string {
  switch (reason) {
    case 'startup':
      return '启动'
    case 'maintenance':
      return '维护'
    case 'update':
      return '更新'
    case 'shutdown':
      return '退出'
    default:
      return reason
  }
}

function formatProgressValue(value: number, unit: TaskRunProgressUnit | undefined): string {
  if (unit === 'byte') {
    return formatBytes(value)
  }

  return formatNumber(value)
}

function formatProgressUnit(unit: TaskRunProgressUnit): string {
  switch (unit) {
    case 'item':
      return '项'
    case 'file':
      return '文件'
    case 'byte':
      return '字节'
    case 'entity':
      return '项'
    case 'step':
      return '步骤'
    case 'package':
      return '包'
    case 'request':
      return '请求'
  }
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0'
  }

  if (Math.abs(value) >= 10) {
    return Math.round(value).toLocaleString('zh-Hans')
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatRateNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0'
  }

  if (Math.abs(value) >= 10) {
    return Math.round(value).toLocaleString('zh-Hans')
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
  switch (period) {
    case 'second':
      return '秒'
    case 'minute':
      return '分钟'
    case 'hour':
      return '小时'
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatDurationShort(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0 秒'
  }

  const totalSeconds = Math.max(1, Math.floor(ms / 1000))
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  if (hours > 0) {
    return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`
  }

  if (minutes > 0) {
    return seconds > 0 ? `${minutes} 分钟 ${seconds} 秒` : `${minutes} 分钟`
  }

  return `${seconds} 秒`
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
