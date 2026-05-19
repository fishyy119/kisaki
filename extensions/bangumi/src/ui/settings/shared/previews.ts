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
  BangumiPreviewChange,
  BangumiPreviewKey,
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

export function createDialogPreviewChangesField<
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
}):
  | SettingsPanelField<SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>>
  | undefined {
  if (!preview) {
    return undefined
  }

  return {
    id,
    label,
    orientation: 'vertical',
    contentLayout: 'stack',
    content: [
      settings.table({
        id: `${id}.changes`,
        columns: [
          { key: 'game', label: '游戏', truncate: true, weight: 2.2 },
          { key: 'bangumi', label: 'Bangumi', kind: 'link' },
          { key: 'action', label: '操作', kind: 'badge', weight: 0.8 },
          { key: 'local', label: '本地值', truncate: true, weight: 1.4 },
          { key: 'remote', label: '远端值', truncate: true, weight: 1.4 }
        ],
        rows: readPreviewChanges(preview.result),
        emptyLabel: '没有将要更改的游戏'
      })
    ]
  }
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

function readPreviewChanges(result: CommandExecutionResult): readonly BangumiPreviewChange[] {
  if (result.status !== 'completed') {
    return []
  }

  const output = asPlainRecord(result.output)
  const changes = output?.changes
  if (!Array.isArray(changes)) {
    return []
  }

  return changes.filter(isPreviewChange)
}

function isPreviewChange(value: unknown): value is BangumiPreviewChange {
  const record = asPlainRecord(value)
  const bangumi = asPlainRecord(record?.bangumi)

  return (
    typeof record?.game === 'string' &&
    typeof record.action === 'string' &&
    typeof record.local === 'string' &&
    typeof record.remote === 'string' &&
    typeof bangumi?.label === 'string' &&
    typeof bangumi.href === 'string'
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
