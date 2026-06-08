import type {
  EmptySettingsPanelPopoverMap,
  ExtensionFileGrant,
  ExtensionTaskRunInitiator,
  JsonObject,
  SettingsPanelFooterAction,
  SettingsPanelField,
  SettingsPanelNodeFactory,
  SettingsPanelRootNodeEvents,
  SettingsPanelRootSubmitEvent
} from '@kisaki3/extension-sdk'
import { VNITE_BACKUP_MAX_SIZE_BYTES } from '../../shared/constants'
import { toSafeErrorMessage } from '../../shared/errors'
import { omitUndefined } from '../../shared/object'
import { createVniteSettingsDialogs } from './dialogs'
import { VNITE_SETTINGS_NODE_IDS } from './ids'
import { readVniteImportFormOptions, type VniteImportFormOptions } from './options'
import type { VniteSettingsResourceSnapshot } from './resources'
import { resolveVniteSettingsResources } from './resources'
import type { VniteStoredFileGrant } from './flow'
import { resolveVniteImportStep } from './flow'
import { createVniteImportPreviewGames } from './preview-games'
import type { VniteSettingsRuntime } from './runtime'

type VniteSettingsDialogs = ReturnType<typeof createVniteSettingsDialogs>
type VniteRootEvents = SettingsPanelRootNodeEvents<
  EmptySettingsPanelPopoverMap,
  VniteSettingsDialogs
>
export type VniteRootSettingsUi = SettingsPanelNodeFactory<VniteRootEvents>
export type VniteRootSettingsField = SettingsPanelField<VniteRootEvents>

export async function submitVniteRoot(
  runtime: VniteSettingsRuntime,
  event: SettingsPanelRootSubmitEvent
) {
  const resources = await resolveVniteSettingsResources(runtime)
  const step = resolveVniteImportStep({
    flow: resources.flow,
    hasActiveRun: !!resources.activeRun
  })

  switch (step) {
    case 'pickBackup':
      return await submitPickBackup(runtime, event, resources.flow.file)
    case 'configureImport':
      return await submitPreview(runtime, event, resources)
    case 'previewGraph':
      return await submitImport(runtime, event, resources)
    case 'running':
      return event.refresh('root')
    case 'done':
      await runtime.flowStore.reset()
      return event.refresh('root')
  }
}

export function createPickBackupFileButton(
  ui: VniteRootSettingsUi,
  runtime: VniteSettingsRuntime,
  options: { label?: string } = {}
) {
  return ui.button({
    id: VNITE_SETTINGS_NODE_IDS.pickBackupFile,
    label: options.label ?? '选择文件',
    icon: 'icon-[mdi--file-upload-outline]',
    async onClick(event) {
      const grant = await pickVniteBackupFile(runtime)
      if (!grant) {
        return event.refresh('root')
      }

      const flow = await runtime.flowStore.get()
      if (flow.file && flow.file.grantId !== grant.grantId) {
        await runtime.files.releaseGrant(flow.file.grantId).catch((error) => {
          runtime.logger.warn(
            'Vnite importer failed to release replaced file grant.',
            toSafeSettingsLog(error)
          )
        })
      }

      await runtime.flowStore.setFileGrant(grant, 'pickBackup')
      return event.refresh('root', {
        message: '已选择备份包。'
      })
    }
  })
}

export function createChooseAnotherFooterAction(
  runtime: VniteSettingsRuntime
): SettingsPanelFooterAction<VniteRootEvents> {
  return {
    id: VNITE_SETTINGS_NODE_IDS.chooseAnotherBackup,
    label: '重新选择',
    placement: 'start',
    async onClick(event) {
      const flow = await runtime.flowStore.get()
      if (flow.file) {
        await runtime.files.releaseGrant(flow.file.grantId).catch((error) => {
          runtime.logger.warn(
            'Vnite importer failed to release file grant.',
            toSafeSettingsLog(error)
          )
        })
      }
      await runtime.flowStore.reset()
      return event.refresh('root')
    }
  }
}

export function createBackToConfigureFooterAction(
  runtime: VniteSettingsRuntime
): SettingsPanelFooterAction<VniteRootEvents> {
  return {
    id: VNITE_SETTINGS_NODE_IDS.backToConfigure,
    label: '返回修改',
    placement: 'start',
    async onClick(event) {
      await runtime.flowStore.setStep('configureImport')
      return event.refresh('root')
    }
  }
}

export function createRefreshPreviewFooterAction(
  runtime: VniteSettingsRuntime
): SettingsPanelFooterAction<VniteRootEvents> {
  return {
    id: VNITE_SETTINGS_NODE_IDS.refreshPreview,
    label: '重新预览',
    async onClick(event) {
      const resources = await resolveVniteSettingsResources(runtime)
      const fileGrant = requireFileGrant(resources.flow.file)
      const form = await readSubmitForm(runtime, event.values as JsonObject, resources.settings)
      validateCompletionOptions(form)
      const result = await withSettingsLoading(runtime, {
        id: 'vnite-importer.settings.preview',
        title: '正在生成 Vnite 导入预览',
        message: '正在读取备份包并计算写入计划。',
        run: async () =>
          await runtime.jobRunner.previewFromGrant({
            fileGrant,
            requestId: createRequestId(),
            fieldSelection: form.fieldSelection,
            conflictMode: form.conflictMode,
            strictAttachments: form.strictAttachments
          })
      })
      await runtime.flowStore.setPreview({
        createdAt: Date.now(),
        analysis: result.analysis,
        graph: result.execution.graph,
        summary: result.execution.summary,
        games: await createVniteImportPreviewGames({
          snapshot: result.snapshot,
          graph: result.execution.graph,
          library: runtime.library
        })
      })
      return event.refresh('root', {
        message: '资料库图预览已更新。'
      })
    }
  }
}

export function toUserErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return 'Vnite 导入操作失败。'
}

export function toSafeSettingsLog(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    }
  }

  return {
    message: toSafeErrorMessage(error)
  }
}

async function withSettingsLoading<T>(
  runtime: VniteSettingsRuntime,
  input: {
    id: string
    title: string
    message: string
    run: () => Promise<T>
  }
): Promise<T> {
  let notificationId: string | undefined
  try {
    const handle = await runtime.notify
      .loading(input.title, {
        id: input.id,
        message: input.message,
        closable: true
      })
      .catch((error) => {
        runtime.logger.warn(
          'Vnite importer failed to show settings loading notification.',
          toSafeSettingsLog(error)
        )
        return undefined
      })
    notificationId = handle?.id

    return await input.run()
  } finally {
    if (notificationId) {
      await runtime.notify.dismiss(notificationId).catch((error) => {
        runtime.logger.warn(
          'Vnite importer failed to dismiss settings loading notification.',
          toSafeSettingsLog(error)
        )
      })
    }
  }
}

async function submitPickBackup(
  runtime: VniteSettingsRuntime,
  event: SettingsPanelRootSubmitEvent,
  file: VniteStoredFileGrant | undefined
) {
  const fileGrant = requireFileGrant(file)
  const analysis = await withSettingsLoading(runtime, {
    id: 'vnite-importer.settings.analyze',
    title: '正在分析 Vnite 备份包',
    message: '正在读取备份包内容并统计可导入数据。',
    run: async () =>
      await runtime.jobRunner.analyzeFromGrant({
        fileGrant,
        requestId: createRequestId()
      })
  })
  await runtime.flowStore.setAnalysis(analysis)

  return event.refresh('root', {
    message: '备份包分析完成。'
  })
}

async function pickVniteBackupFile(
  runtime: VniteSettingsRuntime
): Promise<ExtensionFileGrant | null> {
  return await runtime.files.pickFile({
    title: '选择 Vnite 备份包',
    filters: [{ name: 'Vnite 备份包', extensions: ['zip'] }],
    copyTo: 'temp',
    maxSizeBytes: VNITE_BACKUP_MAX_SIZE_BYTES
  })
}

async function submitPreview(
  runtime: VniteSettingsRuntime,
  event: SettingsPanelRootSubmitEvent,
  resources: VniteSettingsResourceSnapshot
) {
  const fileGrant = requireFileGrant(resources.flow.file)
  const form = await readSubmitForm(runtime, event.values as JsonObject, resources.settings)
  await persistRootOptions(runtime, form)
  validateCompletionOptions(form)

  const result = await withSettingsLoading(runtime, {
    id: 'vnite-importer.settings.preview',
    title: '正在生成 Vnite 导入预览',
    message: '正在读取备份包并计算写入计划。',
    run: async () =>
      await runtime.jobRunner.previewFromGrant({
        fileGrant,
        requestId: createRequestId(),
        fieldSelection: form.fieldSelection,
        conflictMode: form.conflictMode,
        strictAttachments: form.strictAttachments
      })
  })
  await runtime.flowStore.setPreview({
    createdAt: Date.now(),
    analysis: result.analysis,
    graph: result.execution.graph,
    summary: result.execution.summary,
    games: await createVniteImportPreviewGames({
      snapshot: result.snapshot,
      graph: result.execution.graph,
      library: runtime.library
    })
  })

  return event.refresh('root', {
    message: '资料库图预览已生成。'
  })
}

async function submitImport(
  runtime: VniteSettingsRuntime,
  event: SettingsPanelRootSubmitEvent,
  resources: VniteSettingsResourceSnapshot
) {
  const fileGrant = requireFileGrant(resources.flow.file)
  const form = await readSubmitForm(runtime, event.values as JsonObject, resources.settings)
  await persistRootOptions(runtime, form)
  validateCompletionOptions(form)

  const result = await runtime.jobRunner.startImportFromGrant({
    fileGrant,
    requestId: createRequestId(),
    fieldSelection: form.fieldSelection,
    conflictMode: form.conflictMode,
    strictAttachments: form.strictAttachments,
    completion: omitUndefined({
      enabled: form.completion.enabled,
      profileId: form.completion.profileId,
      surfaces: form.completion.surfaces
    }),
    initiator: { type: 'user' } satisfies ExtensionTaskRunInitiator
  })
  await runtime.flowStore.setActiveRun(result.runId)

  return event.close('root', {
    message: '导入任务已开始。'
  })
}

async function readSubmitForm(
  runtime: VniteSettingsRuntime,
  values: JsonObject,
  settings: VniteSettingsResourceSnapshot['settings']
): Promise<VniteImportFormOptions> {
  const profiles = await runtime.scrapers.profiles.list({ mediaType: 'game' })
  return readVniteImportFormOptions({
    values,
    settings,
    defaultProfileId: profiles[0]?.id,
    profilesAvailable: profiles.length > 0
  })
}

async function persistRootOptions(
  runtime: VniteSettingsRuntime,
  form: VniteImportFormOptions
): Promise<void> {
  await runtime.settingsStore.update((settings) => ({
    ...settings,
    defaults: omitUndefined({
      ...settings.defaults,
      conflictMode: form.conflictMode,
      completeMetadata: form.completion.enabled,
      completionSurfacePreset: form.completion.preset,
      completionSurfaces: form.completion.surfaces,
      strictAttachments: form.strictAttachments,
      scraperProfileId: form.completion.profileId ?? settings.defaults.scraperProfileId
    })
  }))
}

function requireFileGrant(
  file: VniteStoredFileGrant | undefined
): Pick<ExtensionFileGrant, 'grantId' | 'name' | 'path' | 'sizeBytes'> {
  if (!file) {
    throw new Error('请先选择 Vnite 备份包。')
  }

  return file
}

function validateCompletionOptions(form: VniteImportFormOptions): void {
  if (form.completion.enabled && !form.completion.profileId) {
    throw new Error('请先选择刮削配置，或关闭补全。')
  }
}

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `vnite-import:${Date.now()}`
}
