import { defineSettingsPanel } from '@kisaki3/extension-sdk'
import {
  VNITE_IMPORTER_NAME,
  VNITE_IMPORTER_PANEL_ID
} from '../../shared/constants'

export function createVniteImporterSettingsPanel() {
  return defineSettingsPanel({
    id: VNITE_IMPORTER_PANEL_ID,
    title: VNITE_IMPORTER_NAME,
    size: 'lg',
    submitLabel: '刷新状态',
    resolve(_context, settings) {
      return {
        title: VNITE_IMPORTER_NAME,
        description: '从 Vnite 数据库备份包导入游戏和用户数据。',
        fields: [
          {
            id: 'status',
            label: '状态',
            content: [
              settings.status({
                id: 'extension-status',
                tone: 'neutral',
                label: '扩展',
                value: '已加载'
              }),
              settings.notice({
                id: 'import-flow-pending',
                tone: 'info',
                text: '导入流程尚未启用。'
              })
            ]
          }
        ]
      }
    },
    submit(event) {
      return event.refresh('root', {
        message: 'Vnite 导入状态已刷新。'
      })
    }
  })
}
