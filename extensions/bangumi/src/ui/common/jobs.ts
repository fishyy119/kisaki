import { kisaki, type CommandExecutionResult, type SerializableRecord } from '@kisaki/extension-sdk'
import { ActiveJobRegistry, type BangumiActiveJobScope } from '../../jobs/active-registry'
import { BANGUMI_COMMAND_IDS, type BangumiCommandId } from '../../jobs/commands'
import type {
  BangumiSettingsDialogButtonEvent,
  BangumiSettingsDialogButtonResult,
  BangumiSettingsDialogFactory,
  BangumiSettingsDialogField,
  BangumiSettingsDialogSubmitEvent,
  BangumiSettingsDialogSubmitResult,
  BangumiSettingsRootButtonEvent,
  BangumiSettingsRootButtonResult,
  BangumiSettingsRootFactory,
  BangumiSettingsRootField,
  ResolvedActiveJob
} from './types'
import { toSettingsError } from './errors'

export async function resolveActiveJobs(activeJobRegistry: ActiveJobRegistry): Promise<{
  accountRefresh?: ResolvedActiveJob
  syncFull?: ResolvedActiveJob
  importMyCollections?: ResolvedActiveJob
  importIndex?: ResolvedActiveJob
}> {
  const [accountRefresh, syncFull, importMyCollections, importIndex] = await Promise.all([
    resolveActiveJob(activeJobRegistry, 'account.refresh'),
    resolveActiveJob(activeJobRegistry, 'sync.full'),
    resolveActiveJob(activeJobRegistry, 'import.myCollections'),
    resolveActiveJob(activeJobRegistry, 'import.index')
  ])

  return {
    ...(accountRefresh ? { accountRefresh } : {}),
    ...(syncFull ? { syncFull } : {}),
    ...(importMyCollections ? { importMyCollections } : {}),
    ...(importIndex ? { importIndex } : {})
  }
}

export async function resolveActiveJob(
  activeJobRegistry: ActiveJobRegistry,
  scope: BangumiActiveJobScope
): Promise<ResolvedActiveJob | undefined> {
  const active = activeJobRegistry.get(scope)
  if (!active) {
    return undefined
  }

  try {
    const progress = await kisaki.commands.getProgress(active.executionId)
    if (progress) {
      return { active, progress }
    }

    const result = await waitForCompletedResult(active.executionId, 120)
    if (result) {
      activeJobRegistry.deleteExecution(scope, active.executionId)
      return { active, result }
    }

    return { active }
  } catch {
    activeJobRegistry.deleteExecution(scope, active.executionId)
    return undefined
  }
}

export function createActiveJobField({
  settings,
  id,
  label,
  scope,
  activeJob,
  activeJobRegistry
}: {
  settings: BangumiSettingsRootFactory
  id: string
  label: string
  scope: BangumiActiveJobScope
  activeJob?: ResolvedActiveJob
  activeJobRegistry: ActiveJobRegistry
}): BangumiSettingsRootField | undefined {
  if (!activeJob) {
    return undefined
  }

  const status = formatActiveJobStatus(activeJob)
  const rows = readJobSummaryRows(activeJob.result)

  return {
    id,
    label,
    orientation: 'vertical',
    contentLayout: 'stack',
    content: [
      settings.status({
        id: `${id}.status`,
        tone: status.tone,
        label: activeJob.active.argsSummary ?? activeJob.active.commandId,
        value: status.value
      }),
      settings.text({
        id: `${id}.detail`,
        text: status.detail,
        tone: status.textTone
      }),
      settings.table({
        id: `${id}.summary`,
        hidden: rows.length === 0,
        columns: [
          { key: 'name', label: '项目' },
          { key: 'value', label: '数量', kind: 'number' }
        ],
        rows
      }),
      settings.button({
        id: `${id}.cancel`,
        label: '取消',
        tone: 'danger',
        hidden: !activeJob.progress || !activeJob.active.cancelable,
        async onClick(event) {
          try {
            return await cancelRootManualJob({
              scope,
              activeJobRegistry,
              event
            })
          } catch (error) {
            return event.fail(toSettingsError(error), { refresh: 'root' })
          }
        }
      })
    ]
  }
}

export function createDialogActiveJobField({
  settings,
  id,
  label,
  scope,
  activeJob,
  activeJobRegistry
}: {
  settings: BangumiSettingsDialogFactory
  id: string
  label: string
  scope: BangumiActiveJobScope
  activeJob?: ResolvedActiveJob
  activeJobRegistry: ActiveJobRegistry
}): BangumiSettingsDialogField | undefined {
  if (!activeJob) {
    return undefined
  }

  const status = formatActiveJobStatus(activeJob)
  const rows = readJobSummaryRows(activeJob.result)

  return {
    id,
    label,
    orientation: 'vertical',
    contentLayout: 'stack',
    content: [
      settings.status({
        id: `${id}.status`,
        tone: status.tone,
        label: activeJob.active.argsSummary ?? activeJob.active.commandId,
        value: status.value
      }),
      settings.text({
        id: `${id}.detail`,
        text: status.detail,
        tone: status.textTone
      }),
      settings.table({
        id: `${id}.summary`,
        hidden: rows.length === 0,
        columns: [
          { key: 'name', label: '项目' },
          { key: 'value', label: '数量', kind: 'number' }
        ],
        rows
      }),
      settings.button({
        id: `${id}.cancel`,
        label: '取消',
        tone: 'danger',
        hidden: !activeJob.progress || !activeJob.active.cancelable,
        async onClick(event) {
          try {
            return await cancelDialogManualJob({
              scope,
              activeJobRegistry,
              event
            })
          } catch (error) {
            return event.fail(toSettingsError(error), { refresh: 'dialog' })
          }
        }
      })
    ]
  }
}

export async function startRootManualJob(options: {
  scope: BangumiActiveJobScope
  commandId: BangumiCommandId
  args: SerializableRecord
  argsSummary: string
  activeJobRegistry: ActiveJobRegistry
  event: BangumiSettingsRootButtonEvent
}): Promise<BangumiSettingsRootButtonResult> {
  const activeError = createActiveJobError(options.scope, options.activeJobRegistry)
  if (activeError) {
    return options.event.fail(activeError, { refresh: 'root' })
  }

  await startCommandJob(options)
  return options.event.success({
    refresh: 'root'
  })
}

export function startDialogManualJob(options: {
  scope: BangumiActiveJobScope
  commandId: BangumiCommandId
  args: SerializableRecord
  argsSummary: string
  activeJobRegistry: ActiveJobRegistry
  event: BangumiSettingsDialogButtonEvent
}): Promise<BangumiSettingsDialogButtonResult>
export function startDialogManualJob(options: {
  scope: BangumiActiveJobScope
  commandId: BangumiCommandId
  args: SerializableRecord
  argsSummary: string
  activeJobRegistry: ActiveJobRegistry
  event: BangumiSettingsDialogSubmitEvent
}): Promise<BangumiSettingsDialogSubmitResult>
export async function startDialogManualJob(options: {
  scope: BangumiActiveJobScope
  commandId: BangumiCommandId
  args: SerializableRecord
  argsSummary: string
  activeJobRegistry: ActiveJobRegistry
  event: BangumiSettingsDialogButtonEvent | BangumiSettingsDialogSubmitEvent
}): Promise<BangumiSettingsDialogButtonResult | BangumiSettingsDialogSubmitResult> {
  const activeError = createActiveJobError(options.scope, options.activeJobRegistry)
  if (activeError) {
    return options.event.fail(activeError, { refresh: 'dialog' })
  }

  await startCommandJob(options)
  return options.event.success({
    refresh: 'dialog'
  })
}

export function maybeField(
  field: BangumiSettingsRootField | undefined
): BangumiSettingsRootField[] {
  return field ? [field] : []
}

export function maybeDialogField(
  field: BangumiSettingsDialogField | undefined
): BangumiSettingsDialogField[] {
  return field ? [field] : []
}

export function formatDateTime(value: number | null | undefined): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false
  })
}

async function waitForCompletedResult(
  executionId: string,
  timeoutMs: number
): Promise<CommandExecutionResult | undefined> {
  const waitPromise = kisaki.commands.wait(executionId)
  const timeoutPromise = new Promise<undefined>((resolve) => {
    setTimeout(() => resolve(undefined), timeoutMs)
  })

  const result = await Promise.race([waitPromise, timeoutPromise])
  if (!result) {
    void waitPromise.catch(() => undefined)
  }
  return result
}

async function startCommandJob({
  scope,
  commandId,
  args,
  argsSummary,
  activeJobRegistry
}: {
  scope: BangumiActiveJobScope
  commandId: BangumiCommandId
  args: SerializableRecord
  argsSummary: string
  activeJobRegistry: ActiveJobRegistry
}): Promise<void> {
  const started = await kisaki.commands.start({
    commandId,
    args
  })
  activeJobRegistry.set({
    scope,
    commandId: started.commandId,
    executionId: started.executionId,
    startedAt: started.startedAt,
    cancelable: started.cancelable,
    argsSummary
  })
}

async function cancelRootManualJob(options: {
  scope: BangumiActiveJobScope
  activeJobRegistry: ActiveJobRegistry
  event: BangumiSettingsRootButtonEvent
}): Promise<BangumiSettingsRootButtonResult> {
  const cancelled = await cancelCommandJob(options.scope, options.activeJobRegistry)
  return options.event.success({
    message: formatCancelJobMessage(cancelled),
    refresh: 'root'
  })
}

async function cancelDialogManualJob(options: {
  scope: BangumiActiveJobScope
  activeJobRegistry: ActiveJobRegistry
  event: BangumiSettingsDialogButtonEvent
}): Promise<BangumiSettingsDialogButtonResult> {
  const cancelled = await cancelCommandJob(options.scope, options.activeJobRegistry)
  return options.event.success({
    message: formatCancelJobMessage(cancelled),
    refresh: 'dialog'
  })
}

async function cancelCommandJob(
  scope: BangumiActiveJobScope,
  activeJobRegistry: ActiveJobRegistry
): Promise<boolean | undefined> {
  const active = activeJobRegistry.get(scope)
  if (!active) {
    return undefined
  }

  const cancelled = await kisaki.commands.cancel(active.executionId)
  activeJobRegistry.deleteExecution(scope, active.executionId)
  return cancelled
}

function createActiveJobError(scope: BangumiActiveJobScope, activeJobRegistry: ActiveJobRegistry) {
  return activeJobRegistry.get(scope)
    ? {
        code: 'bangumi_job_running',
        message: '已有 Bangumi job 正在运行，请先等待完成或取消。'
      }
    : undefined
}

function formatCancelJobMessage(cancelled: boolean | undefined): string {
  if (cancelled === undefined) {
    return '当前没有运行中的 Bangumi job。'
  }

  return cancelled ? '已请求取消 Bangumi job。' : 'Bangumi job 已结束。'
}

function formatActiveJobStatus(activeJob: ResolvedActiveJob): {
  tone: 'neutral' | 'success' | 'warning' | 'danger'
  textTone: 'default' | 'muted' | 'danger'
  value: string
  detail: string
} {
  if (activeJob.result) {
    const success = activeJob.result.status === 'completed'
    return {
      tone: success ? 'success' : activeJob.result.status === 'cancelled' ? 'warning' : 'danger',
      textTone: success ? 'muted' : 'danger',
      value: formatCommandResultStatus(activeJob.result.status),
      detail: activeJob.result.error ?? formatFinishedAt(activeJob.result.finishedAt)
    }
  }

  if (activeJob.progress) {
    return {
      tone: 'neutral',
      textTone: 'muted',
      value: '运行中',
      detail: `进度会通过通知实时更新 · 启动于 ${
        formatDateTime(activeJob.active.startedAt) ?? '未知时间'
      }`
    }
  }

  return {
    tone: 'neutral',
    textTone: 'muted',
    value: '启动中',
    detail: `启动于 ${formatDateTime(activeJob.active.startedAt) ?? '未知时间'}`
  }
}

function formatCommandResultStatus(status: CommandExecutionResult['status']): string {
  if (status === 'completed') {
    return '已完成'
  }
  if (status === 'cancelled') {
    return '已取消'
  }
  return '失败'
}

function formatFinishedAt(finishedAt: number): string {
  return `完成于 ${formatDateTime(finishedAt) ?? '未知时间'}`
}

function readJobSummaryRows(
  result: CommandExecutionResult | undefined
): readonly SerializableRecord[] {
  if (result?.status !== 'completed') {
    return []
  }

  const output = asPlainRecord(result.output)
  const counters = asPlainRecord(output?.counters)
  if (!counters) {
    return []
  }

  return Object.entries(counters)
    .filter((entry): entry is [string, number] => {
      const [, value] = entry
      return typeof value === 'number' && Number.isFinite(value)
    })
    .map(([key, value]) => ({
      name: formatCounterLabel(key),
      value
    }))
}

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function formatCounterLabel(key: string): string {
  switch (key) {
    case 'accountRefreshed':
      return '账号摘要已刷新'
    case 'checkedToken':
      return '已检查凭据'
    case 'indices':
      return '目录'
    case 'processed':
      return '已扫描'
    case 'queued':
      return '队列项'
    case 'refreshed':
      return '已刷新凭据'
    case 'selectedCollectionTypes':
      return '收藏类型'
    case 'selectedSyncFields':
      return '同步项目'
    case 'selectedWriteFields':
      return '写入字段'
    case 'skippedExistingLocalGame':
      return '已存在本地游戏'
    case 'skippedNoBangumiId':
      return '无 Bangumi ID'
    case 'skippedNoChange':
      return '无需修改'
    case 'skippedByMapping':
      return '无同步项目'
    case 'skippedPendingImporter':
      return '等待导入器接入'
    case 'skippedPendingSyncEngine':
      return '等待同步引擎接入'
    case 'verified':
      return '已验证账号'
    case 'withBangumiId':
      return '已有 Bangumi ID'
    case 'wouldCreate':
      return '将创建'
    case 'wouldImport':
      return '将导入'
    case 'wouldSync':
      return '将同步'
    default:
      return key
  }
}

export { BANGUMI_COMMAND_IDS, ActiveJobRegistry }
