import type {
  ExtensionTaskRunSnapshot,
  SettingsPanelAnyNodeEvents,
  SettingsPanelButtonNode,
  SettingsPanelField,
  SettingsPanelNodeFactory
} from '@kisaki3/extension-sdk'
import type { VniteImportJobSummary } from '../../import/summary'
import type { VniteImportFlowState, VniteImportPreviewGame, VniteImportPreviewState } from './flow'
import { countVisibleDiagnostics } from './diagnostics-view'

const WRITE_PLAN_ROW_LIMIT = 120
const UPDATE_PLAN_GROUP_LIMIT = 40

export function createPickBackupFields<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  input: {
    flow: VniteImportFlowState
    pickButton: SettingsPanelButtonNode<TEvents['buttonEvent'], TEvents['buttonResult']>
  }
): readonly SettingsPanelField<TEvents>[] {
  const file = input.flow.file
  const fields: SettingsPanelField<TEvents>[] = [
    {
      id: 'backup-file',
      label: '备份包',
      description: '选择从 Vnite 导出的数据库备份 zip。',
      contentLayout: 'inline',
      content: [
        ui.status({
          id: 'backup-file-status',
          tone: file ? 'success' : 'neutral',
          label: file?.name ?? '文件',
          value: file ? formatBytes(file.sizeBytes) : '未选择'
        }),
        input.pickButton
      ]
    }
  ]

  return fields
}

export function createFieldSelectionSummaryField<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  selectedCount: number,
  totalCount: number,
  editButton: SettingsPanelField<TEvents>['content'][number]
): SettingsPanelField<TEvents> {
  return {
    id: 'field-selection-summary',
    label: '字段',
    contentLayout: 'inline',
    content: [
      ui.status({
        id: 'field-selection-count',
        tone: selectedCount > 0 ? 'success' : 'warning',
        label: '已选择',
        value: `${selectedCount}/${totalCount}`
      }),
      editButton
    ]
  }
}

export function createPreviewGraphFields<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  preview: VniteImportPreviewState,
  diagnosticsButton: SettingsPanelField<TEvents>['content'][number]
): readonly SettingsPanelField<TEvents>[] {
  const counters = preview.summary.counters
  const errorCount = counters.errors ?? 0
  const warningSummaryCount = counters.warnings ?? 0
  const diagnosticCount = countVisibleDiagnostics(preview.summary.diagnostics)

  return [
    {
      id: 'preview-summary',
      label: '预览',
      contentLayout: 'grid',
      contentColumns: 2,
      content: [
        ui.status({
          id: 'preview-created',
          tone: 'success',
          label: '新增',
          value: String(counters.gamesCreated)
        }),
        ui.status({
          id: 'preview-updated',
          tone: 'success',
          label: '更新',
          value: String(counters.gamesUpdated)
        }),
        ui.status({
          id: 'preview-skipped',
          tone: counters.gamesSkipped > 0 ? 'warning' : 'neutral',
          label: '跳过',
          value: String(counters.gamesSkipped)
        }),
        ui.status({
          id: 'preview-errors',
          tone: errorCount > 0 ? 'danger' : 'neutral',
          label: 'Error',
          value: String(errorCount)
        }),
        ui.status({
          id: 'preview-warnings',
          tone: warningSummaryCount > 0 ? 'warning' : 'neutral',
          label: 'Warning',
          value: String(warningSummaryCount)
        })
      ]
    },
    createWritePlanField(ui, preview.games),
    createUpdatePlanField(ui, preview.games),
    ...(diagnosticCount > 0
      ? [createDiagnosticsLauncherField(ui, diagnosticCount, diagnosticsButton)]
      : [])
  ]
}

export function createRunningFields<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  run: ExtensionTaskRunSnapshot | undefined,
  flow: VniteImportFlowState
): readonly SettingsPanelField<TEvents>[] {
  const counters = run?.progress?.counters ?? {}

  return [
    {
      id: 'running-status',
      label: '运行状态',
      content: [
        ui.status({
          id: 'running-task',
          tone: run ? 'success' : 'warning',
          label: 'TaskRun',
          value: run?.progress?.phase?.label ?? run?.status ?? flow.activeRunId ?? '正在刷新'
        }),
        ui.notice({
          id: 'running-cancel-notice',
          tone: 'info',
          text: '导入运行中，取消请到任务中心处理。'
        })
      ]
    },
    {
      id: 'running-counters',
      label: '计数',
      content: [
        ui.table({
          id: 'running-counters-table',
          columns: [
            { key: 'label', label: '项目' },
            { key: 'value', label: '数量', kind: 'number' }
          ],
          rows: Object.entries(counters).map(([key, value]) => ({
            label: key,
            value
          })),
          emptyLabel: '暂无进度计数。'
        })
      ]
    }
  ]
}

export function createDoneFields<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  summary: VniteImportJobSummary | undefined,
  diagnosticsButton: SettingsPanelField<TEvents>['content'][number]
): readonly SettingsPanelField<TEvents>[] {
  if (!summary) {
    return [
      {
        id: 'done-empty',
        label: '结果',
        content: [
          ui.notice({
            id: 'done-empty-notice',
            tone: 'info',
            text: '导入任务已结束。'
          })
        ]
      }
    ]
  }

  return [
    createJobSummaryField(ui, summary, '导入摘要'),
    ...(countVisibleDiagnostics(summary.diagnostics) > 0
      ? [
          createDiagnosticsLauncherField(
            ui,
            countVisibleDiagnostics(summary.diagnostics),
            diagnosticsButton
          )
        ]
      : [])
  ]
}

function createJobSummaryField<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  summary: VniteImportJobSummary,
  label: string
): SettingsPanelField<TEvents> {
  const errorCount = summary.counters.errors ?? 0
  const warningCount = summary.counters.warnings ?? 0

  return {
    id: 'job-summary',
    label,
    contentLayout: 'grid',
    contentColumns: 2,
    content: [
      ui.status({
        id: 'summary-created',
        tone: 'success',
        label: '新增',
        value: String(summary.counters.gamesCreated)
      }),
      ui.status({
        id: 'summary-updated',
        tone: 'success',
        label: '更新',
        value: String(summary.counters.gamesUpdated)
      }),
      ui.status({
        id: 'summary-completion',
        tone: summary.counters.completionFailed > 0 ? 'warning' : 'neutral',
        label: '补全成功',
        value: String(summary.counters.completionCompleted)
      }),
      ui.status({
        id: 'summary-errors',
        tone: errorCount > 0 ? 'danger' : 'neutral',
        label: 'Error',
        value: String(errorCount)
      }),
      ui.status({
        id: 'summary-warnings',
        tone: warningCount > 0 ? 'warning' : 'neutral',
        label: 'Warning',
        value: String(warningCount)
      })
    ]
  }
}

function createWritePlanField<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  games: readonly VniteImportPreviewGame[]
): SettingsPanelField<TEvents> {
  const plannedGames = games.filter(isWritePlannedGame)

  return {
    id: 'write-plan',
    label: '写入计划',
    content: [
      ui.table({
        id: 'write-plan-table',
        title: createWritePlanTitle(plannedGames.length),
        columns: [{ key: 'game', label: '游戏', truncate: true }],
        rows: plannedGames.slice(0, WRITE_PLAN_ROW_LIMIT).map((game) => ({
          game: game.title
        })),
        emptyLabel: '没有需要写入的游戏。'
      })
    ]
  }
}

function createUpdatePlanField<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  games: readonly VniteImportPreviewGame[]
): SettingsPanelField<TEvents> {
  const updateGames = games.filter((game) => game.action === 'update')

  return {
    id: 'update-plan',
    label: '更新计划',
    content: [
      ui.comparisonList({
        id: 'update-plan-list',
        title: createUpdatePlanTitle(updateGames.length),
        groups: updateGames.slice(0, UPDATE_PLAN_GROUP_LIMIT).map(toUpdatePlanGroup),
        emptyLabel: '没有需要更新的已有游戏。'
      })
    ]
  }
}

function createDiagnosticsLauncherField<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  diagnosticCount: number,
  diagnosticsButton: SettingsPanelField<TEvents>['content'][number]
): SettingsPanelField<TEvents> {
  return {
    id: 'diagnostics-entry',
    label: '诊断',
    contentLayout: 'inline',
    content: [
      ui.status({
        id: 'diagnostics-count',
        tone: 'warning',
        label: '需要处理',
        value: String(diagnosticCount)
      }),
      diagnosticsButton
    ]
  }
}

function createWritePlanTitle(total: number): string {
  return total > WRITE_PLAN_ROW_LIMIT
    ? `游戏写入名单（前 ${WRITE_PLAN_ROW_LIMIT} / ${total}）`
    : '游戏写入名单'
}

function createUpdatePlanTitle(total: number): string {
  return total > UPDATE_PLAN_GROUP_LIMIT
    ? `已有游戏更新计划（前 ${UPDATE_PLAN_GROUP_LIMIT} / ${total}）`
    : '已有游戏更新计划'
}

function toUpdatePlanGroup(game: VniteImportPreviewGame) {
  const rows = [
    {
      label: '资料',
      before: game.existing?.metadata ?? '-',
      after: formatMetadataPlan(game),
      tone: 'info' as const
    },
    {
      label: '记录',
      before: game.existing?.activity ?? '-',
      after: formatActivityPlan(game),
      tone: 'info' as const
    },
    {
      label: '组织 / 媒体',
      before: game.existing?.organization ?? '-',
      after: formatImportDataPlan(game),
      tone: 'info' as const
    }
  ].filter((row) => row.after !== '-')

  return {
    id: game.key,
    title: game.title,
    rows:
      rows.length > 0
        ? rows
        : [
            {
              label: '更新',
              before: formatExistingFallback(game),
              after: '按所选字段更新',
              tone: 'info' as const
            }
          ]
  }
}

function formatExistingFallback(game: VniteImportPreviewGame): string {
  return (
    formatParts([game.existing?.metadata, game.existing?.activity, game.existing?.organization]) ||
    '-'
  )
}

function isWritePlannedGame(game: VniteImportPreviewGame): boolean {
  return game.action === 'create' || game.action === 'update'
}

function formatMetadataPlan(game: VniteImportPreviewGame): string {
  return formatParts([
    formatLabeledValue('名称', game.name),
    formatLabeledValue('原名', game.originalName),
    formatLabeledValue('发售', game.releaseDate),
    formatLabeledValue('开发', game.developers),
    formatLabeledValue('发行', game.publishers),
    formatLabeledValue('平台', game.platforms),
    formatLabeledValue('类型', game.genres)
  ])
}

function formatActivityPlan(game: VniteImportPreviewGame): string {
  return formatParts([game.playStatus, game.score, game.playTime])
}

function formatImportDataPlan(game: VniteImportPreviewGame): string {
  return formatParts([
    formatLabeledValue('合集', game.collections),
    formatLabeledValue('标签', game.tags),
    game.attachments,
    formatLabeledValue('路径', game.localPath)
  ])
}

function formatLabeledValue(label: string, value: string | undefined): string | undefined {
  return value ? `${label} ${value}` : undefined
}

function formatParts(parts: readonly (string | undefined)[]): string {
  const normalized = parts.filter((part): part is string => !!part)
  return normalized.length ? normalized.join(' / ') : '-'
}

export function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`
  }

  const units = ['KB', 'MB', 'GB'] as const
  let current = value / 1024
  for (const unit of units) {
    if (current < 1024 || unit === 'GB') {
      return `${current.toFixed(current >= 10 ? 0 : 1)} ${unit}`
    }
    current /= 1024
  }

  return `${value} B`
}
