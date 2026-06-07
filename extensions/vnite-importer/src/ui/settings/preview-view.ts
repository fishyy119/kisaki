import type {
  ExtensionTaskRunSnapshot,
  SettingsPanelAnyNodeEvents,
  SettingsPanelField,
  SettingsPanelNodeFactory
} from '@kisaki3/extension-sdk'
import type { VniteBackupAnalysisSummary, VniteImportDiagnostic } from '../../backup/types'
import type { VniteImportExecutionSummary, VniteImportJobSummary } from '../../import/summary'
import type { VniteImportFlowState, VniteImportPreviewState } from './flow'
import { countAllFields, countSelectedFields } from './options'
import type { VniteImporterSettingsV1 } from '../../config'

export function createPickBackupFields<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  input: {
    settings: VniteImporterSettingsV1
    flow: VniteImportFlowState
  }
): readonly SettingsPanelField<TEvents>[] {
  const fields: SettingsPanelField<TEvents>[] = [
    {
      id: 'backup-file',
      label: '备份包',
      content: [
        ui.status({
          id: 'backup-file-status',
          tone: 'neutral',
          label: '文件',
          value: '尚未选择备份包'
        }),
        ui.notice({
          id: 'backup-pick-notice',
          tone: 'info',
          text: '请选择从 Vnite 导出的数据库备份 zip。'
        })
      ]
    }
  ]

  if (input.settings.cleanup.keepLastAnalysis && input.flow.lastSummary) {
    fields.push(createJobSummaryField(ui, input.flow.lastSummary, '上一次导入摘要'))
  }

  return fields
}

export function createAnalyzeBackupFields<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  flow: VniteImportFlowState,
  onChooseAnother: SettingsPanelField<TEvents>['content'][number]
): readonly SettingsPanelField<TEvents>[] {
  return [
    {
      id: 'selected-file',
      label: '备份包',
      orientation: 'horizontal',
      contentLayout: 'inline',
      content: [
        ui.status({
          id: 'selected-file-status',
          tone: 'success',
          label: flow.file?.name ?? '文件',
          value: flow.file ? formatBytes(flow.file.sizeBytes) : '未选择'
        }),
        onChooseAnother
      ]
    },
    {
      id: 'analysis-pending',
      label: '分析',
      content: [
        ui.notice({
          id: 'analysis-pending-notice',
          tone: 'info',
          text: '分析会读取游戏、合集、标签、游玩记录、媒体附件、存档记录和回忆记录统计。'
        })
      ]
    }
  ]
}

export function createAnalysisSummaryFields<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  analysis: VniteBackupAnalysisSummary
): readonly SettingsPanelField<TEvents>[] {
  const warningCount = analysis.diagnostics.filter((item) => item.level === 'warning').length

  return [
    {
      id: 'analysis-summary',
      label: '分析结果',
      contentLayout: 'grid',
      contentColumns: 2,
      content: [
        ui.status({
          id: 'analysis-games',
          tone: 'success',
          label: '游戏',
          value: String(analysis.statistics.games.total)
        }),
        ui.status({
          id: 'analysis-collections',
          tone: 'success',
          label: '合集',
          value: String(analysis.statistics.collections.total)
        }),
        ui.status({
          id: 'analysis-attachments',
          tone: 'success',
          label: '媒体附件',
          value: String(analysis.statistics.attachments.total)
        }),
        ui.status({
          id: 'analysis-warnings',
          tone: warningCount > 0 ? 'warning' : 'neutral',
          label: 'Warning',
          value: String(warningCount)
        })
      ]
    },
    {
      id: 'analysis-field-coverage',
      label: '字段覆盖',
      content: [
        ui.table({
          id: 'field-coverage-table',
          columns: [
            { key: 'label', label: '字段' },
            { key: 'present', label: '可导入', kind: 'number' },
            { key: 'total', label: '总数', kind: 'number' },
            { key: 'coverage', label: '覆盖率' }
          ],
          rows: analysis.fieldCoverage.map((item) => ({
            label: item.label,
            present: item.present,
            total: item.total,
            coverage: formatCoverage(item.present, item.total)
          }))
        })
      ]
    },
    {
      id: 'analysis-details',
      label: '分布',
      contentLayout: 'grid',
      contentColumns: 2,
      content: [
        ui.table({
          id: 'external-id-table',
          title: '外部 ID',
          columns: [
            { key: 'source', label: '来源' },
            { key: 'count', label: '数量', kind: 'number' }
          ],
          rows: Object.entries(analysis.statistics.externalIds).map(([source, count]) => ({
            source,
            count
          }))
        }),
        ui.table({
          id: 'status-table',
          title: '游玩状态',
          columns: [
            { key: 'status', label: '状态' },
            { key: 'count', label: '数量', kind: 'number' }
          ],
          rows: Object.entries(analysis.statistics.statusDistribution).map(([status, count]) => ({
            status,
            count
          }))
        })
      ]
    }
  ]
}

export function createFieldSelectionSummaryField<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  settings: VniteImporterSettingsV1,
  editButton: SettingsPanelField<TEvents>['content'][number]
): SettingsPanelField<TEvents> {
  const selected = countSelectedFields(settings.defaults.fieldSelection)
  const total = countAllFields()

  return {
    id: 'field-selection-summary',
    label: '字段',
    orientation: 'horizontal',
    contentLayout: 'inline',
    content: [
      ui.status({
        id: 'field-selection-count',
        tone: selected > 0 ? 'success' : 'warning',
        label: '已选择',
        value: `${selected}/${total}`
      }),
      editButton
    ]
  }
}

export function createPreviewGraphFields<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  preview: VniteImportPreviewState,
  actions: readonly SettingsPanelField<TEvents>['content'][number][]
): readonly SettingsPanelField<TEvents>[] {
  const counters = preview.summary.counters
  const warningCount = preview.summary.diagnostics.filter((item) => item.level === 'warning').length

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
          id: 'preview-warnings',
          tone: warningCount > 0 ? 'warning' : 'neutral',
          label: 'Warning',
          value: String(warningCount)
        })
      ]
    },
    {
      id: 'preview-actions',
      label: '操作',
      orientation: 'horizontal',
      contentLayout: 'inline',
      content: actions
    },
    {
      id: 'preview-games',
      label: '资料库图',
      content: [
        ui.comparisonList({
          id: 'preview-game-list',
          title: '游戏写入计划',
          summary: [
            { label: '游戏', value: String(counters.gamesTotal) },
            { label: '附件', value: String(counters.attachmentsImported) },
            { label: '合集新增', value: String(counters.collectionsCreated) }
          ],
          groups: preview.graph.nodes
            .filter((node) => node.kind === 'media' && node.mediaType === 'game')
            .slice(0, 80)
            .map((node) => ({
              id: node.key,
              title: toGameTitle(node.key),
              badges: [
                {
                  label: toActionLabel(node.action),
                  tone: toActionTone(node.action)
                }
              ],
              rows: [
                {
                  label: '来源',
                  before: 'Vnite',
                  after: toGameTitle(node.key),
                  tone: 'info'
                },
                {
                  label: '目标',
                  before: 'Kisaki',
                  after: node.entityId ?? '导入后生成',
                  tone: node.entityId ? 'success' : 'neutral'
                }
              ]
            })),
          emptyLabel: '没有可预览的游戏。'
        })
      ]
    },
    createDiagnosticsField(ui, preview.summary.diagnostics)
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
  summary: VniteImportJobSummary | undefined
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
    createDiagnosticsField(ui, summary.diagnostics)
  ]
}

function createJobSummaryField<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  summary: VniteImportJobSummary,
  label: string
): SettingsPanelField<TEvents> {
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
        id: 'summary-warnings',
        tone: summary.counters.warnings > 0 ? 'warning' : 'neutral',
        label: 'Warning',
        value: String(summary.counters.warnings)
      })
    ]
  }
}

function createDiagnosticsField<TEvents extends SettingsPanelAnyNodeEvents>(
  ui: SettingsPanelNodeFactory<TEvents>,
  diagnostics: readonly VniteImportDiagnostic[]
): SettingsPanelField<TEvents> {
  return {
    id: 'diagnostics',
    label: '诊断',
    content: [
      ui.table({
        id: 'diagnostics-table',
        columns: [
          { key: 'level', label: '级别' },
          { key: 'game', label: '游戏', truncate: true },
          { key: 'issue', label: '问题', truncate: true },
          { key: 'result', label: '处理结果', truncate: true }
        ],
        rows: diagnostics.slice(0, 120).map((diagnostic) => ({
          level: toDiagnosticLevelLabel(diagnostic.level),
          game: diagnostic.vniteGameName ?? diagnostic.vniteGameId ?? diagnostic.itemKey ?? '-',
          issue: diagnostic.code,
          result: diagnostic.message
        })),
        emptyLabel: '没有诊断信息。'
      })
    ]
  }
}

function formatCoverage(present: number, total: number): string {
  return total > 0 ? `${Math.round((present / total) * 100)}%` : '0%'
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

function toGameTitle(key: string): string {
  return key.startsWith('vnite:game:') ? key.slice('vnite:game:'.length) : key
}

function toActionLabel(action: string): string {
  switch (action) {
    case 'create':
      return '新增'
    case 'update':
      return '更新'
    case 'skip':
      return '跳过'
    case 'fail':
      return '失败'
    default:
      return action
  }
}

function toActionTone(action: string): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (action) {
    case 'create':
    case 'update':
      return 'success'
    case 'skip':
      return 'warning'
    case 'fail':
      return 'danger'
    default:
      return 'neutral'
  }
}

function toDiagnosticLevelLabel(level: string): string {
  switch (level) {
    case 'warning':
      return 'Warning'
    case 'error':
      return 'Error'
    case 'info':
    default:
      return 'Info'
  }
}
