import {
  ExtensionTaskRunCancellation,
  kisaki,
  type CommandInvocationResult,
  type ExtensionTaskRunProgressUpdate,
  type ExtensionTaskRunResult,
  type JsonObject,
  type SettingsPanelDialogNodeEvents,
  type SettingsPanelField,
  type SettingsPanelNodeFactory
} from '@kisaki3/extension-sdk'
import type { BangumiCommandId } from '../../../jobs/commands'
import type { BangumiJobHandle } from '../../../jobs/runner'
import { omitUndefined } from '../../../shared/object'
import { createRunningJobError, isBangumiCommandActive } from './jobs'
import type {
  BangumiPreviewBadge,
  BangumiPreviewGroup,
  BangumiPreviewKey,
  BangumiPreviewRow,
  BangumiPreviewTone,
  BangumiSettingsDialogButtonEvent,
  BangumiSettingsDialogButtonResult,
  BangumiSettingsDialogSubmitEvent,
  BangumiSettingsDialogSubmitResult,
  BangumiSettingsPopovers,
  ResolvedPreviewResult
} from './types'
import { toSettingsError } from './errors'

const PREVIEW_RESULT_TTL_MS = 30 * 60 * 1000
const PREVIEW_RESULT_LIMIT = 32

type PreviewResult = Omit<ExtensionTaskRunResult, 'status' | 'error'>

export class PreviewResultRegistry {
  private readonly results = new Map<string, ResolvedPreviewResult>()

  get(
    sessionId: string,
    previewKey: BangumiPreviewKey,
    args: JsonObject
  ): ResolvedPreviewResult | undefined {
    this.prune()
    const stored = this.results.get(this.createKey(sessionId, previewKey))
    if (!stored || serializePreviewArgs(stored.args) !== serializePreviewArgs(args)) {
      return undefined
    }
    return stored
  }

  setCompleted(
    sessionId: string,
    previewKey: BangumiPreviewKey,
    args: JsonObject,
    result: CommandInvocationResult
  ): void {
    this.prune()
    this.results.set(this.createKey(sessionId, previewKey), {
      state: 'completed',
      args,
      result
    })
    this.enforceLimit()
  }

  delete(sessionId: string, previewKey: BangumiPreviewKey): void {
    this.results.delete(this.createKey(sessionId, previewKey))
  }

  private createKey(sessionId: string, previewKey: BangumiPreviewKey): string {
    return `${sessionId}:${previewKey}`
  }

  private prune(now = Date.now()): void {
    for (const [key, result] of [...this.results]) {
      const createdAt = readPreviewResultCreatedAt(result.result)
      if (now - createdAt <= PREVIEW_RESULT_TTL_MS) {
        continue
      }

      this.results.delete(key)
    }
  }

  private enforceLimit(): void {
    while (this.results.size > PREVIEW_RESULT_LIMIT) {
      const oldestKey = this.results.keys().next().value
      if (!oldestKey) {
        break
      }

      this.results.delete(oldestKey)
    }
  }
}

export function createDialogPreviewFields<TParams extends JsonObject = JsonObject>({
  settings,
  id,
  label,
  emptyLabel,
  preview
}: {
  settings: SettingsPanelNodeFactory<
    SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>
  >
  id: string
  label: string
  emptyLabel?: string | undefined
  preview?: ResolvedPreviewResult | undefined
}): readonly SettingsPanelField<SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>>[] {
  if (!preview) {
    return []
  }

  const groups = readPreviewGroups(preview.result)

  return [
    {
      id,
      label,
      orientation: 'vertical',
      contentLayout: 'stack',
      content: [
        settings.comparisonList({
          id: `${id}.groups`,
          summary: summarizePreviewGroups(groups),
          groups,
          emptyLabel: emptyLabel ?? '没有将要更改的条目'
        })
      ]
    }
  ]
}

export async function runDialogPreview(options: {
  previewKey: BangumiPreviewKey
  commandId: BangumiCommandId
  title: string
  args: JsonObject
  signal: AbortSignal
  run(run: BangumiJobHandle): Promise<unknown>
  previewRegistry: PreviewResultRegistry
  event: BangumiSettingsDialogButtonEvent
}): Promise<BangumiSettingsDialogButtonResult> {
  try {
    if (await isBangumiCommandActive(options.commandId)) {
      return options.event.fail(createRunningJobError(), { refresh: 'dialog' })
    }

    const result = await startPreviewRun(options)
    options.previewRegistry.setCompleted(
      options.event.sessionId,
      options.previewKey,
      options.args,
      result
    )

    return options.event.success({ refresh: 'dialog' })
  } catch (error) {
    return options.event.fail(toSettingsError(error), { refresh: 'dialog' })
  }
}

export async function runDialogSubmitPreview(options: {
  previewKey: BangumiPreviewKey
  commandId: BangumiCommandId
  title: string
  args: JsonObject
  signal: AbortSignal
  run(run: BangumiJobHandle): Promise<unknown>
  previewRegistry: PreviewResultRegistry
  event: BangumiSettingsDialogSubmitEvent
}): Promise<BangumiSettingsDialogSubmitResult> {
  try {
    if (await isBangumiCommandActive(options.commandId)) {
      return options.event.fail(createRunningJobError(), { refresh: 'dialog' })
    }

    const result = await startPreviewRun(options)
    options.previewRegistry.setCompleted(
      options.event.sessionId,
      options.previewKey,
      options.args,
      result
    )

    return options.event.success({ refresh: 'dialog' })
  } catch (error) {
    return options.event.fail(toSettingsError(error), { refresh: 'dialog' })
  }
}

async function startPreviewRun(options: {
  commandId: BangumiCommandId
  title: string
  signal: AbortSignal
  run(run: BangumiJobHandle): Promise<unknown>
}): Promise<CommandInvocationResult> {
  const run = await createNotificationPreviewHandle({
    commandId: options.commandId,
    title: options.title,
    signal: options.signal
  })
  const output = await options.run(run)
  return omitUndefined({
    commandId: options.commandId,
    output: output as CommandInvocationResult['output']
  })
}

async function createNotificationPreviewHandle(options: {
  commandId: string
  title: string
  signal: AbortSignal
}): Promise<BangumiJobHandle> {
  const id = createPreviewNotificationId(options.commandId)
  const handle = await kisaki.notify.loading(options.title, {
    id,
    message: '正在准备预览...',
    closable: true
  })

  return new NotificationPreviewHandle({
    id: handle.id,
    title: options.title,
    signal: options.signal
  })
}

class NotificationPreviewHandle implements BangumiJobHandle {
  constructor(
    private readonly options: {
      id: string
      title: string
      signal: AbortSignal
    }
  ) {}

  get signal(): AbortSignal {
    return this.options.signal
  }

  async report(update: ExtensionTaskRunProgressUpdate): Promise<void> {
    await kisaki.notify.update(
      this.options.id,
      'loading',
      this.options.title,
      omitUndefined({
        message: formatPreviewProgress(update),
        closable: true
      })
    )
  }

  async checkpoint(): Promise<void> {
    if (this.signal.aborted) {
      throw new ExtensionTaskRunCancellation('Bangumi preview was cancelled.')
    }
  }

  async complete(result?: PreviewResult): Promise<void> {
    await kisaki.notify.update(this.options.id, 'success', this.options.title, {
      message: result?.summary ?? '预览已完成。',
      closable: true
    })
  }

  async fail(_error: unknown, result?: PreviewResult): Promise<void> {
    await kisaki.notify.update(this.options.id, 'error', this.options.title, {
      message: result?.summary ?? '预览失败。',
      closable: true
    })
  }

  async cancel(result?: PreviewResult): Promise<void> {
    await kisaki.notify.update(this.options.id, 'warning', this.options.title, {
      message: result?.summary ?? '预览已取消。',
      closable: true
    })
  }
}

function formatPreviewProgress(update: ExtensionTaskRunProgressUpdate): string | undefined {
  const base = update.phase?.label
  const count = formatProgressCount(update)
  const percent = formatProgressPercent(update)
  const suffix = [count, percent].filter(Boolean).join(' ')
  return suffix ? [base, suffix].filter(Boolean).join(' ') : base
}

function formatProgressCount(update: ExtensionTaskRunProgressUpdate): string | undefined {
  const current = update.work?.current
  const total = update.work?.total

  if (current === undefined && total === undefined) {
    return undefined
  }

  if (current !== undefined && total !== undefined) {
    return `(${current}/${total})`
  }

  if (current !== undefined) {
    return `(${current})`
  }

  return undefined
}

function formatProgressPercent(update: ExtensionTaskRunProgressUpdate): string | undefined {
  const current = update.work?.current
  const total = update.work?.total
  if (
    typeof current !== 'number' ||
    typeof total !== 'number' ||
    !Number.isFinite(current) ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return undefined
  }

  return `${Math.round(Math.min(100, (current / total) * 100))}%`
}

function createPreviewNotificationId(commandId: string): string {
  return `bangumi.preview.${commandId}.${Date.now()}.${Math.random().toString(36).slice(2)}`
}

function readPreviewGroups(result: CommandInvocationResult): readonly BangumiPreviewGroup[] {
  const output = asPlainRecord(result.output)
  const groups = output?.previewGroups
  if (!Array.isArray(groups)) {
    return []
  }

  return groups.filter(isPreviewGroup).sort(comparePreviewGroups)
}

function readPreviewResultCreatedAt(result: CommandInvocationResult): number {
  const output = asPlainRecord(result.output)
  return typeof output?.finishedAt === 'number' ? output.finishedAt : Date.now()
}

function summarizePreviewGroups(groups: readonly BangumiPreviewGroup[]) {
  const counts = new Map<string, { value: number; tone?: BangumiPreviewTone }>()

  for (const group of groups) {
    const badge = group.badges[0]
    const key = badge?.label || '变更'
    const existing = counts.get(key)
    if (existing) {
      existing.value += 1
    } else {
      counts.set(key, { value: 1, tone: badge?.tone })
    }
  }

  return [...counts.entries()].map(([label, count]) => ({
    label,
    value: String(count.value),
    ...(count.tone ? { tone: count.tone } : {})
  }))
}

function isPreviewGroup(value: unknown): value is BangumiPreviewGroup {
  const record = asPlainRecord(value)
  const link = asPlainRecord(record?.link)
  const badges = record?.badges
  const rows = record?.rows

  return (
    typeof record?.id === 'string' &&
    typeof record.title === 'string' &&
    typeof link?.label === 'string' &&
    typeof link.href === 'string' &&
    Array.isArray(badges) &&
    badges.every(isPreviewBadge) &&
    Array.isArray(rows) &&
    rows.every(isPreviewRow)
  )
}

function isPreviewBadge(value: unknown): value is BangumiPreviewBadge {
  const record = asPlainRecord(value)
  return typeof record?.label === 'string' && isPreviewTone(record.tone)
}

function isPreviewRow(value: unknown): value is BangumiPreviewRow {
  const record = asPlainRecord(value)
  return (
    typeof record?.label === 'string' &&
    typeof record.before === 'string' &&
    typeof record.after === 'string' &&
    isPreviewTone(record.tone)
  )
}

function isPreviewTone(value: unknown): value is BangumiPreviewTone {
  return (
    value === 'neutral' ||
    value === 'info' ||
    value === 'success' ||
    value === 'warning' ||
    value === 'danger'
  )
}

function comparePreviewGroups(a: BangumiPreviewGroup, b: BangumiPreviewGroup): number {
  const order = getPreviewGroupOrder(a) - getPreviewGroupOrder(b)
  return order !== 0 ? order : a.title.localeCompare(b.title, 'zh-CN')
}

function getPreviewGroupOrder(group: BangumiPreviewGroup): number {
  const label = group.badges[0]?.label ?? ''
  if (label.includes('更新')) {
    return 10
  }

  if (label.includes('创建')) {
    return 20
  }

  return 30
}

function serializePreviewArgs(args: JsonObject): string {
  return JSON.stringify(args)
}

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
