import type { ScraperProfileSummary, SerializableRecord } from '@kisaki/extension-sdk'
import { BANGUMI_COMMAND_IDS } from '../../jobs/commands'
import { DIALOG_IDS, NODE_IDS } from '../common/constants'
import { toSettingsError } from '../common/errors'
import {
  ActiveJobRegistry,
  createActiveJobField,
  createDialogActiveJobField,
  maybeDialogField,
  maybeField,
  startDialogManualJob
} from '../common/jobs'
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
  BangumiSettingsRootField,
  ResolvedActiveJob
} from '../common/types'
import { createDialogImportProfileField } from './options'

export function createIndexImportFields({
  settings,
  profiles,
  activeJobRegistry,
  activeJob
}: {
  settings: BangumiSettingsRootFactory
  profiles: readonly ScraperProfileSummary[]
  activeJobRegistry: ActiveJobRegistry
  activeJob?: ResolvedActiveJob
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
          disabled: !hasProfile || !!activeJob?.progress,
          onClick(event) {
            return event.openDialog(DIALOG_IDS.importIndex)
          }
        })
      ]
    },
    ...maybeField(
      createActiveJobField({
        settings,
        id: 'import-index-job',
        label: '目录导入任务',
        scope: 'import.index',
        activeJob,
        activeJobRegistry
      })
    )
  ]
}

export function createIndexDialogFields({
  settings,
  values,
  profiles,
  activeJobRegistry,
  previewRegistry,
  sessionId,
  activeJob
}: {
  settings: BangumiSettingsDialogFactory
  values: SerializableRecord
  profiles: readonly ScraperProfileSummary[]
  activeJobRegistry: ActiveJobRegistry
  previewRegistry: PreviewResultRegistry
  sessionId: string
  activeJob?: ResolvedActiveJob
}): BangumiSettingsDialogField[] {
  const isRunning = !!activeJob?.progress
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
    ),
    ...maybeDialogField(
      createDialogActiveJobField({
        settings,
        id: 'index-job',
        label: '导入任务',
        scope: 'import.index',
        activeJob,
        activeJobRegistry
      })
    )
  ]
}

export async function submitIndexDialog({
  event,
  profiles,
  activeJobRegistry
}: {
  event: BangumiSettingsDialogSubmitEvent
  profiles: readonly ScraperProfileSummary[]
  activeJobRegistry: ActiveJobRegistry
}): Promise<BangumiSettingsDialogSubmitResult> {
  try {
    return await startDialogManualJob({
      scope: 'import.index',
      commandId: BANGUMI_COMMAND_IDS.importIndex,
      args: createIndexImportArgs(event.values, profiles[0]?.id ?? '', false),
      argsSummary: '导入目录',
      activeJobRegistry,
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
