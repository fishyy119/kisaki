import { defineSettingsPanel } from '@kisaki3/extension-sdk'
import {
  VNITE_COMPLETION_SURFACE_OPTIONS,
  VNITE_COMPLETION_SURFACE_PRESET_OPTIONS
} from '../../completion'
import { VNITE_IMPORTER_NAME, VNITE_IMPORTER_PANEL_ID } from '../../shared/constants'
import { omitUndefined } from '../../shared/object'
import {
  createBackToConfigureFooterAction,
  createChooseAnotherFooterAction,
  createPickBackupFileButton,
  createRefreshPreviewFooterAction,
  submitVniteRoot,
  toSafeSettingsLog,
  toUserErrorMessage,
  type VniteRootSettingsField,
  type VniteRootSettingsUi
} from './actions'
import { createVniteSettingsDialogs } from './dialogs'
import { getVniteImportSubmitLabel, resolveVniteImportStep, type VniteImportStep } from './flow'
import { VNITE_SETTINGS_DIALOG_IDS, VNITE_SETTINGS_NODE_IDS } from './ids'
import {
  VNITE_CONFLICT_MODE_OPTIONS,
  countAllFields,
  countSelectedFields,
  readVniteImportFormOptions,
  type VniteImportFormOptions
} from './options'
import {
  createAnalysisSummaryFields,
  createDoneFields,
  createFieldSelectionSummaryField,
  createPickBackupFields,
  createPreviewGraphFields,
  createRunningFields
} from './preview-view'
import { resolveVniteSettingsResources, type VniteSettingsResourceSnapshot } from './resources'
import type { VniteSettingsRuntime } from './runtime'

const MAX_TRACKED_ROOT_SESSIONS = 32

export function createVniteImporterSettingsPanel(runtime: VniteSettingsRuntime) {
  const dialogs = createVniteSettingsDialogs(runtime)
  const initializedRootSessions = new Set<string>()

  return defineSettingsPanel({
    id: VNITE_IMPORTER_PANEL_ID,
    title: VNITE_IMPORTER_NAME,
    size: 'lg',
    dialogs,
    async resolve(context, ui) {
      const resources = await resolveVniteSettingsResources(runtime, {
        resetTransientFlow: markRootSessionInitialized(initializedRootSessions, context.sessionId)
      })
      const step = resolveVniteImportStep({
        flow: resources.flow,
        hasActiveRun: !!resources.activeRun
      })
      const defaultProfileId = resources.profiles[0]?.id
      const form = readVniteImportFormOptions({
        values: context.values,
        settings: resources.settings,
        defaultProfileId,
        profilesAvailable: resources.profiles.length > 0
      })

      return {
        title: VNITE_IMPORTER_NAME,
        description: '从 Vnite 数据库备份包导入游戏和用户数据。',
        submitLabel: getVniteImportSubmitLabel(step),
        footerActions: createRootFooterActions({
          runtime,
          step,
          hasPreview: !!resources.flow.preview
        }),
        fields: createRootFields({
          ui,
          runtime,
          resources,
          step,
          form,
          defaultProfileId
        })
      }
    },
    async submit(event) {
      try {
        return await submitVniteRoot(runtime, event)
      } catch (error) {
        runtime.logger.warn('Vnite importer settings submit failed.', toSafeSettingsLog(error))
        return event.fail(
          {
            code: 'vnite_import_failed',
            message: toUserErrorMessage(error)
          },
          { refresh: 'root' }
        )
      }
    }
  })
}

function markRootSessionInitialized(sessions: Set<string>, sessionId: string): boolean {
  if (sessions.has(sessionId)) {
    return false
  }

  sessions.add(sessionId)
  if (sessions.size > MAX_TRACKED_ROOT_SESSIONS) {
    const oldestSession = sessions.values().next().value
    if (oldestSession) {
      sessions.delete(oldestSession)
    }
  }

  return true
}

function createRootFooterActions(input: {
  runtime: VniteSettingsRuntime
  step: VniteImportStep
  hasPreview: boolean
}) {
  if (input.step === 'configureImport') {
    return [createChooseAnotherFooterAction(input.runtime)]
  }

  if (input.step === 'previewGraph' && input.hasPreview) {
    return [
      createBackToConfigureFooterAction(input.runtime),
      createRefreshPreviewFooterAction(input.runtime)
    ]
  }

  return []
}

function createRootFields(input: {
  ui: VniteRootSettingsUi
  runtime: VniteSettingsRuntime
  resources: VniteSettingsResourceSnapshot
  step: VniteImportStep
  form: VniteImportFormOptions
  defaultProfileId?: string
}): readonly VniteRootSettingsField[] {
  if (input.step === 'pickBackup') {
    return createPickBackupFields(input.ui, {
      flow: input.resources.flow,
      pickButton: createPickBackupFileButton(input.ui, input.runtime, {
        label: input.resources.flow.file ? '更换文件' : '选择文件'
      })
    })
  }

  if (input.step === 'previewGraph') {
    return input.resources.flow.preview
      ? createPreviewGraphFields(
          input.ui,
          input.resources.flow.preview,
          createOpenDiagnosticsButton(input.ui)
        )
      : createConfigureFields(input)
  }

  if (input.step === 'running') {
    return createRunningFields(input.ui, input.resources.activeRun, input.resources.flow)
  }

  if (input.step === 'done') {
    return createDoneFields(
      input.ui,
      input.resources.flow.lastSummary,
      createOpenDiagnosticsButton(input.ui)
    )
  }

  return createConfigureFields(input)
}

function createOpenDiagnosticsButton(ui: VniteRootSettingsUi) {
  return ui.button({
    id: VNITE_SETTINGS_NODE_IDS.viewDiagnostics,
    label: '查看诊断',
    onClick(event) {
      return event.openDialog(VNITE_SETTINGS_DIALOG_IDS.diagnostics)
    }
  })
}

function createConfigureFields(input: {
  ui: VniteRootSettingsUi
  runtime: VniteSettingsRuntime
  resources: VniteSettingsResourceSnapshot
  form: VniteImportFormOptions
  defaultProfileId?: string
}): readonly VniteRootSettingsField[] {
  const profilesAvailable = input.resources.profiles.length > 0
  const profileOptions = profilesAvailable
    ? input.resources.profiles.map((profile) =>
        omitUndefined({
          value: profile.id,
          label: profile.name,
          description: profile.description ?? undefined
        })
      )
    : [{ value: '', label: '没有可用刮削配置', disabled: true }]
  const selectedProfileId =
    input.form.completion.profileId ?? input.defaultProfileId ?? profileOptions[0]?.value ?? ''

  return [
    ...(input.resources.flow.analysis
      ? createAnalysisSummaryFields(input.ui, input.resources.flow.analysis)
      : []),
    createFieldSelectionSummaryField(
      input.ui,
      countSelectedFields(input.resources.settings.defaults.fieldSelection),
      countAllFields(),
      input.ui.button({
        id: VNITE_SETTINGS_NODE_IDS.editFields,
        label: '编辑字段',
        onClick(event) {
          return event.openDialog(VNITE_SETTINGS_DIALOG_IDS.fields)
        }
      })
    ),
    {
      id: 'metadata-completion',
      label: '补全',
      content: [
        input.ui.switch({
          id: VNITE_SETTINGS_NODE_IDS.completeMetadata,
          initialValue: input.form.completion.enabled,
          disabled: !profilesAvailable,
          onChange(event) {
            return event.refresh('root')
          }
        }),
        input.ui.notice({
          id: 'metadata-completion-unavailable',
          tone: 'warning',
          text: '没有可用的 game 刮削配置，可以先执行直接导入。',
          hidden: profilesAvailable
        })
      ]
    },
    {
      id: 'scraper-profile',
      label: '刮削配置',
      disabled: !input.form.completion.enabled || !profilesAvailable,
      content: [
        input.ui.select({
          id: VNITE_SETTINGS_NODE_IDS.scraperProfileId,
          initialValue: selectedProfileId,
          options: profileOptions
        })
      ]
    },
    {
      id: 'completion-surface-preset',
      label: '补全范围',
      disabled: !input.form.completion.enabled || !profilesAvailable,
      content: [
        input.ui.radioGroup({
          id: VNITE_SETTINGS_NODE_IDS.completionSurfacePreset,
          initialValue: input.form.completion.preset,
          orientation: 'vertical',
          options: VNITE_COMPLETION_SURFACE_PRESET_OPTIONS,
          onChange(event) {
            return event.refresh('root')
          }
        })
      ]
    },
    {
      id: 'completion-surfaces',
      label: '自定义字段',
      hidden: input.form.completion.preset !== 'custom',
      disabled: !input.form.completion.enabled || !profilesAvailable,
      content: [
        input.ui.multiSelect({
          id: VNITE_SETTINGS_NODE_IDS.completionSurfaces,
          initialValue: input.form.completion.surfaces,
          options: VNITE_COMPLETION_SURFACE_OPTIONS
        })
      ]
    },
    {
      id: 'conflict-mode',
      label: '冲突策略',
      content: [
        input.ui.select({
          id: VNITE_SETTINGS_NODE_IDS.conflictMode,
          initialValue: input.form.conflictMode,
          options: VNITE_CONFLICT_MODE_OPTIONS
        })
      ]
    },
    {
      id: 'strict-attachments',
      label: '附件失败策略',
      description: '启用后，附件导入失败会让相关写入节点失败；关闭时只生成诊断 warning。',
      content: [
        input.ui.switch({
          id: VNITE_SETTINGS_NODE_IDS.strictAttachments,
          initialValue: input.form.strictAttachments
        })
      ]
    }
  ]
}
