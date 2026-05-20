import {
  kisaki,
  type CommandExecutionResult,
  type SerializableRecord,
  type SettingsPanelDialogNodeEvents,
  type SettingsPanelField,
  type SettingsPanelNodeFactory
} from '@kisaki/extension-sdk'
import type { BangumiCommandId } from '../../../jobs/commands'
import type {
  BangumiPreviewBadge,
  BangumiPreviewGroup,
  BangumiPreviewKey,
  BangumiPreviewRow,
  BangumiPreviewTone,
  BangumiSettingsDialogButtonEvent,
  BangumiSettingsDialogButtonResult,
  BangumiSettingsPopovers,
  ResolvedPreviewResult
} from './types'
import { toSettingsError } from './errors'

export class PreviewResultRegistry {
  private readonly results = new Map<string, ResolvedPreviewResult>()

  get(
    sessionId: string,
    previewKey: BangumiPreviewKey,
    args: SerializableRecord
  ): ResolvedPreviewResult | undefined {
    const stored = this.results.get(this.createKey(sessionId, previewKey))
    if (!stored || serializePreviewArgs(stored.args) !== serializePreviewArgs(args)) {
      return undefined
    }
    return stored
  }

  set(
    sessionId: string,
    previewKey: BangumiPreviewKey,
    args: SerializableRecord,
    result: CommandExecutionResult
  ): void {
    this.results.set(this.createKey(sessionId, previewKey), {
      args,
      result
    })
  }

  delete(sessionId: string, previewKey: BangumiPreviewKey): void {
    this.results.delete(this.createKey(sessionId, previewKey))
  }

  private createKey(sessionId: string, previewKey: BangumiPreviewKey): string {
    return `${sessionId}:${previewKey}`
  }
}

export function createDialogPreviewFields<
  TParams extends SerializableRecord = SerializableRecord
>({
  settings,
  id,
  label,
  preview
}: {
  settings: SettingsPanelNodeFactory<
    SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>
  >
  id: string
  label: string
  preview?: ResolvedPreviewResult
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
          emptyLabel: '没有将要更改的游戏'
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
    const result = await runPreviewCommand(options.commandId, options.args)
    options.previewRegistry.set(options.event.sessionId, options.previewKey, options.args, result)

    if (result.status !== 'completed') {
      return options.event.fail(toPreviewResultError(result), { refresh: 'dialog' })
    }

    return options.event.success({ refresh: 'dialog' })
  } catch (error) {
    return options.event.fail(toSettingsError(error), { refresh: 'dialog' })
  }
}

function runPreviewCommand(
  commandId: BangumiCommandId,
  args: SerializableRecord
): Promise<CommandExecutionResult> {
  return kisaki.commands.execute({
    commandId,
    args
  })
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

  return groups.filter(isPreviewGroup)
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

function serializePreviewArgs(args: SerializableRecord): string {
  return JSON.stringify(args)
}

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function toPreviewResultError(result: CommandExecutionResult) {
  if (result.status === 'cancelled') {
    return {
      code: 'bangumi_preview_cancelled',
      message: 'Bangumi 预览已取消。'
    }
  }

  return {
    code: 'bangumi_preview_failed',
    message: result.error ?? 'Bangumi 预览失败，请稍后重试。'
  }
}
