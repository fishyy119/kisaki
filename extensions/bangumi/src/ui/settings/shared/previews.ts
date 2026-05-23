import {
  type CommandExecutionResult,
  type CommandExecutionStartResult,
  type SerializableRecord,
  type SettingsPanelDialogNodeEvents,
  type SettingsPanelField,
  type SettingsPanelNodeFactory
} from '@kisaki3/extension-sdk'
import type { BangumiCommandId } from '../../../jobs/commands'
import { createRunningJobError, isBangumiCommandActive, startBangumiCommandJob } from './jobs'
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

export class PreviewResultRegistry {
  private readonly results = new Map<string, ResolvedPreviewResult>()
  private readonly executionIndex = new Map<
    string,
    { sessionId: string; previewKey: BangumiPreviewKey; args: SerializableRecord }
  >()

  get(
    sessionId: string,
    previewKey: BangumiPreviewKey,
    args: SerializableRecord
  ): ResolvedPreviewResult | undefined {
    this.prune()
    const stored = this.results.get(this.createKey(sessionId, previewKey))
    if (!stored || serializePreviewArgs(stored.args) !== serializePreviewArgs(args)) {
      return undefined
    }
    return stored
  }

  start(
    sessionId: string,
    previewKey: BangumiPreviewKey,
    args: SerializableRecord,
    started: CommandExecutionStartResult
  ): void {
    this.prune()
    const previous = this.results.get(this.createKey(sessionId, previewKey))
    if (previous?.state === 'running') {
      this.executionIndex.delete(previous.executionId)
    }

    this.executionIndex.set(started.executionId, { sessionId, previewKey, args })
    this.results.set(this.createKey(sessionId, previewKey), {
      state: 'running',
      args,
      commandId: started.commandId,
      executionId: started.executionId,
      startedAt: started.startedAt
    })
    this.enforceLimit()
  }

  complete(result: CommandExecutionResult): boolean {
    const indexed = this.executionIndex.get(result.executionId)
    if (!indexed) {
      return false
    }

    this.executionIndex.delete(result.executionId)
    const key = this.createKey(indexed.sessionId, indexed.previewKey)
    const current = this.results.get(key)
    if (current?.state !== 'running' || current.executionId !== result.executionId) {
      return false
    }

    this.results.set(key, {
      state: 'completed',
      args: indexed.args,
      result
    })
    return true
  }

  delete(sessionId: string, previewKey: BangumiPreviewKey): void {
    const key = this.createKey(sessionId, previewKey)
    const current = this.results.get(key)
    if (current?.state === 'running') {
      this.executionIndex.delete(current.executionId)
    }
    this.results.delete(key)
  }

  private createKey(sessionId: string, previewKey: BangumiPreviewKey): string {
    return `${sessionId}:${previewKey}`
  }

  private prune(now = Date.now()): void {
    for (const [key, result] of [...this.results]) {
      const createdAt = result.state === 'running' ? result.startedAt : result.result.finishedAt
      if (now - createdAt <= PREVIEW_RESULT_TTL_MS) {
        continue
      }

      if (result.state === 'running') {
        this.executionIndex.delete(result.executionId)
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

      const result = this.results.get(oldestKey)
      if (result?.state === 'running') {
        this.executionIndex.delete(result.executionId)
      }
      this.results.delete(oldestKey)
    }
  }
}

export function createDialogPreviewFields<TParams extends SerializableRecord = SerializableRecord>({
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
  emptyLabel?: string
  preview?: ResolvedPreviewResult
}): readonly SettingsPanelField<SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>>[] {
  if (!preview) {
    return []
  }

  if (preview.state === 'running') {
    return [
      {
        id,
        label,
        orientation: 'vertical',
        contentLayout: 'stack',
        content: [
          settings.status({
            id: `${id}.running`,
            label: '状态',
            value: '正在生成预览',
            tone: 'warning'
          })
        ]
      }
    ]
  }

  if (preview.result.status !== 'completed') {
    return [
      {
        id,
        label,
        orientation: 'vertical',
        contentLayout: 'stack',
        content: [
          settings.notice({
            id: `${id}.failed`,
            tone: preview.result.status === 'cancelled' ? 'warning' : 'error',
            text:
              preview.result.status === 'cancelled'
                ? '预览已取消。'
                : (preview.result.error ?? '预览生成失败。')
          })
        ]
      }
    ]
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
  args: SerializableRecord
  previewRegistry: PreviewResultRegistry
  event: BangumiSettingsDialogButtonEvent
}): Promise<BangumiSettingsDialogButtonResult> {
  try {
    if (await isBangumiCommandActive(options.commandId)) {
      return options.event.fail(createRunningJobError(), { refresh: 'dialog' })
    }

    const started = await startPreviewCommand(options.commandId, options.args)
    options.previewRegistry.start(
      options.event.sessionId,
      options.previewKey,
      options.args,
      started
    )

    return options.event.success({ refresh: 'dialog' })
  } catch (error) {
    return options.event.fail(toSettingsError(error), { refresh: 'dialog' })
  }
}

export async function runDialogSubmitPreview(options: {
  previewKey: BangumiPreviewKey
  commandId: BangumiCommandId
  args: SerializableRecord
  previewRegistry: PreviewResultRegistry
  event: BangumiSettingsDialogSubmitEvent
}): Promise<BangumiSettingsDialogSubmitResult> {
  try {
    if (await isBangumiCommandActive(options.commandId)) {
      return options.event.fail(createRunningJobError(), { refresh: 'dialog' })
    }

    const started = await startPreviewCommand(options.commandId, options.args)
    options.previewRegistry.start(
      options.event.sessionId,
      options.previewKey,
      options.args,
      started
    )

    return options.event.success({ refresh: 'dialog' })
  } catch (error) {
    return options.event.fail(toSettingsError(error), { refresh: 'dialog' })
  }
}

function startPreviewCommand(
  commandId: BangumiCommandId,
  args: SerializableRecord
): Promise<CommandExecutionStartResult> {
  return startBangumiCommandJob(commandId, args)
}

function readPreviewGroups(result: CommandExecutionResult): readonly BangumiPreviewGroup[] {
  if (result.status !== 'completed') {
    return []
  }

  const output = asPlainRecord(result.output)
  const groups = output?.previewGroups
  if (!Array.isArray(groups)) {
    return []
  }

  return groups.filter(isPreviewGroup).sort(comparePreviewGroups)
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

function serializePreviewArgs(args: SerializableRecord): string {
  return JSON.stringify(args)
}

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
