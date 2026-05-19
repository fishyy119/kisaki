import type { ScraperProfileSummary, SerializableRecord } from '@kisaki/extension-sdk'
import { BANGUMI_COMMAND_IDS } from '../../jobs/commands'
import { DIALOG_IDS, NODE_IDS } from '../common/constants'
import { toSettingsError } from '../common/errors'
import { maybeDialogField, startDialogManualJob } from '../common/jobs'
import {
  createDialogPreviewChangesField,
  PreviewResultRegistry,
  runDialogPreview
} from '../common/preview'
import { readString } from '../common/values'
import type {
  BangumiSettingsDialogFactory,
  BangumiSettingsDialogField,
  BangumiSettingsDialogSubmitEvent,
  BangumiSettingsDialogSubmitResult,
  BangumiSettingsRootFactory,
  BangumiSettingsRootField
} from '../common/types'
import { createDialogImportProfileField } from './options'

export function createIndexImportFields({
  settings,
  profiles,
  isRunning
}: {
  settings: BangumiSettingsRootFactory
  profiles: readonly ScraperProfileSummary[]
  isRunning: boolean
}): BangumiSettingsRootField[] {
  const hasProfile = profiles.length > 0

  return [
    {
      id: 'import-index-entry',
      label: '目录导入',
      orientation: 'horizontal',
      contentLayout: 'inline',
      content: [
        settings.button({
          id: 'open-import-index-dialog',
          label: '配置导入',
          tone: 'primary',
          disabled: !hasProfile || isRunning,
          onClick(event) {
            return event.openDialog(DIALOG_IDS.importIndex)
          }
        })
      ]
    }
  ]
}

export function createIndexDialogFields({
  settings,
  values,
  profiles,
  previewRegistry,
  sessionId,
  isRunning
}: {
  settings: BangumiSettingsDialogFactory
  values: SerializableRecord
  profiles: readonly ScraperProfileSummary[]
  previewRegistry: PreviewResultRegistry
  sessionId: string
  isRunning: boolean
}): BangumiSettingsDialogField[] {
  const previewArgs = createIndexImportArgs(values, profiles[0]?.id ?? '', true)
  const preview = previewRegistry.get(sessionId, 'import.index', previewArgs)

  return [
    {
      id: 'index-input',
      label: 'Bangumi 目录',
      content: [
        settings.textInput({
          id: NODE_IDS.importIndexInput,
          initialValue: readString(values, NODE_IDS.importIndexInput, ''),
          placeholder: 'Bangumi 目录 ID 或 URL',
          inputMode: 'url',
          grow: true,
          onCommit(event) {
            return event.refresh('dialog')
          }
        })
      ]
    },
    createDialogImportProfileField({
      settings,
      values,
      profiles
    }),
    {
      id: 'index-preview-action',
      label: '预览',
      orientation: 'horizontal',
      contentLayout: 'inline',
      content: [
        settings.button({
          id: 'index-preview',
          label: '预览将导入的游戏',
          disabled: isRunning,
          async onClick(event) {
            return runDialogPreview({
              previewKey: 'import.index',
              commandId: BANGUMI_COMMAND_IDS.importIndex,
              args: createIndexImportArgs(event.values, profiles[0]?.id ?? '', true),
              previewRegistry,
              event
            })
          }
        })
      ]
    },
    ...maybeDialogField(
      createDialogPreviewChangesField({
        settings,
        id: 'index-preview-changes',
        label: '将导入的游戏',
        preview
      })
    )
  ]
}

export async function submitIndexDialog({
  event,
  profiles
}: {
  event: BangumiSettingsDialogSubmitEvent
  profiles: readonly ScraperProfileSummary[]
}): Promise<BangumiSettingsDialogSubmitResult> {
  try {
    return await startDialogManualJob({
      commandId: BANGUMI_COMMAND_IDS.importIndex,
      args: createIndexImportArgs(event.values, profiles[0]?.id ?? '', false),
      event
    })
  } catch (error) {
    return event.fail(toSettingsError(error), { refresh: 'dialog' })
  }
}

function createIndexImportArgs(
  values: SerializableRecord,
  fallbackProfileId: string,
  dryRun: boolean
): SerializableRecord {
  return {
    dryRun,
    profileId: readString(values, NODE_IDS.importProfileId, fallbackProfileId),
    indexInput: readString(values, NODE_IDS.importIndexInput, ''),
    targetCollection: {
      kind: 'none'
    },
    concurrency: 4
  }
}
