import { defineSettingsPanelDialog } from '@kisaki3/extension-sdk'
import type { VniteImportDiagnostic } from '../../backup/types'
import {
  createDiagnosticsTitle,
  createVisibleDiagnostics,
  toDiagnosticsTableRows
} from './diagnostics-view'
import type { VniteImportFlowState } from './flow'
import type { VniteSettingsRuntime } from './runtime'

export function createVniteDiagnosticsDialog(runtime: VniteSettingsRuntime) {
  return defineSettingsPanelDialog({
    title: '诊断',
    size: 'lg',
    submitLabel: '关闭',
    async resolve(_context, ui) {
      const flow = await runtime.flowStore.get()
      const diagnostics = createVisibleDiagnostics(resolveCurrentDiagnostics(flow))

      return {
        fields: [
          {
            id: 'diagnostics',
            label: '诊断',
            content: [
              ui.table({
                id: 'diagnostics-table',
                title: createDiagnosticsTitle(diagnostics.length),
                columns: [
                  { key: 'level', label: '级别', weight: 0.6 },
                  { key: 'subject', label: '对象', truncate: true, weight: 1.3 },
                  { key: 'message', label: '说明', truncate: true, weight: 3 }
                ],
                rows: toDiagnosticsTableRows(diagnostics),
                emptyLabel: '没有需要处理的诊断。'
              })
            ]
          }
        ]
      }
    },
    submit(event) {
      return event.close('dialog')
    }
  })
}

function resolveCurrentDiagnostics(flow: VniteImportFlowState): readonly VniteImportDiagnostic[] {
  return (
    flow.preview?.summary.diagnostics ??
    flow.lastSummary?.diagnostics ??
    flow.analysis?.diagnostics ??
    []
  )
}
