import type {
  ExtensionFileGrant,
  ExtensionLogger,
  ExtensionTaskRunSnapshot,
  FilesCapability,
  LibraryCapability,
  NotifyCapability,
  ScrapersCapability,
  ExtensionTaskRunsCapability
} from '@kisaki3/extension-sdk'
import type { VniteImportDiagnostic } from '../backup/types'
import type { VniteImporterSettingsStore, VniteImporterSettingsV1 } from '../config'
import {
  getVniteImportSubmitLabel,
  resolveVniteImportStep,
  type VniteImportFlowState,
  type VniteImportFlowStore,
  type VniteImportPreviewGame,
  type VniteStoredFileGrant
} from './store'
import { createVniteImportPreviewGames } from './preview-games'
import { createVisibleDiagnostics, toDiagnosticsTableRows } from './diagnostics'
import type { VniteImportJobRunner } from '../jobs/import-runner'
import type { VniteImportJobSummary } from '../import/summary'
import { VNITE_BACKUP_MAX_SIZE_BYTES } from '../utils/constants'
import { omitUndefined } from '../utils/object'
import type {
  VniteImportOptionsForm,
  VnitePreviewDto,
  VnitePreviewUpdateGroupDto,
  VniteImportWizardHostFunctions,
  VniteWizardState
} from '../../shared/import-wizard'
import { countAllFields, countSelectedFields } from '../../shared/import-wizard'

const WRITE_PLAN_ROW_LIMIT = 120
const UPDATE_PLAN_GROUP_LIMIT = 40

export interface VniteImportWizardRuntime {
  settingsStore: VniteImporterSettingsStore
  flowStore: VniteImportFlowStore
  jobRunner: VniteImportJobRunner
  library: LibraryCapability
  files: FilesCapability
  notify: NotifyCapability
  scrapers: ScrapersCapability
  taskRuns: ExtensionTaskRunsCapability
  logger: ExtensionLogger
  abortSignal: AbortSignal
}

export function createVniteImportWizardFunctions(
  runtime: VniteImportWizardRuntime
): VniteImportWizardHostFunctions {
  return {
    getState: () => resolveWizardState(runtime),

    async pickBackupFile() {
      const grant = await runtime.files.pickFile({
        title: '选择 Vnite 备份包',
        filters: [{ name: 'Vnite 备份包', extensions: ['zip'] }],
        copyTo: 'temp',
        maxSizeBytes: VNITE_BACKUP_MAX_SIZE_BYTES
      })

      if (grant) {
        const flow = await runtime.flowStore.get()
        if (flow.file && flow.file.grantId !== grant.grantId) {
          await releaseGrant(runtime, flow.file.grantId)
        }
        await runtime.flowStore.setFileGrant(grant, 'pickBackup')
      }

      return resolveWizardState(runtime)
    },

    async goToConfig() {
      const flow = await runtime.flowStore.get()
      requireFileGrant(flow.file)
      await runtime.flowStore.setStep('config')
      return resolveWizardState(runtime)
    },

    async backToConfig() {
      await runtime.flowStore.setStep('config')
      return resolveWizardState(runtime)
    },

    async resetFlow() {
      await resetTransientFlow(runtime)
      return resolveWizardState(runtime)
    },

    async saveFieldSelection(selection) {
      await runtime.settingsStore.update((settings) => ({
        ...settings,
        defaults: {
          ...settings.defaults,
          fieldSelection: selection
        }
      }))
      return resolveWizardState(runtime)
    },

    async generatePreview(options) {
      const flow = await runtime.flowStore.get()
      const fileGrant = requireFileGrant(flow.file)
      const settings = await persistOptions(runtime, options)
      validateCompletionOptions(options)

      const result = await withLoadingNotification(runtime, {
        id: 'vnite-importer.settings.preview',
        title: '正在生成 Vnite 导入预览',
        message: '正在读取备份包并计算写入计划。',
        run: () =>
          runtime.jobRunner.previewFromGrant({
            fileGrant,
            requestId: createRequestId(),
            fieldSelection: settings.defaults.fieldSelection,
            conflictMode: settings.defaults.conflictMode,
            strictAttachments: settings.defaults.strictAttachments
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

      return resolveWizardState(runtime)
    },

    async startImport(options) {
      const flow = await runtime.flowStore.get()
      const fileGrant = requireFileGrant(flow.file)
      const settings = await persistOptions(runtime, options)
      validateCompletionOptions(options)

      const result = await runtime.jobRunner.startImportFromGrant({
        fileGrant,
        requestId: createRequestId(),
        fieldSelection: settings.defaults.fieldSelection,
        conflictMode: settings.defaults.conflictMode,
        strictAttachments: settings.defaults.strictAttachments,
        completion: omitUndefined({
          enabled: options.completeMetadata,
          profileId: options.scraperProfileId || undefined,
          surfaces: options.completionSurfaces
        }),
        initiator: { type: 'user' }
      })
      await runtime.flowStore.setActiveRun(result.runId)

      return resolveWizardState(runtime)
    }
  }
}

/**
 * Drops stale wizard state left behind by an earlier session when no import
 * run is active anymore.
 */
export async function prepareVniteImportWizardSession(
  runtime: VniteImportWizardRuntime
): Promise<void> {
  const runState = await resolveImportRunState(runtime)
  if (runState.activeRun) {
    return
  }

  const flow = runState.flow
  if (flow.file || flow.preview || flow.activeRunId || flow.step !== 'pickBackup') {
    await resetTransientFlow(runtime)
  }
}

async function resolveWizardState(runtime: VniteImportWizardRuntime): Promise<VniteWizardState> {
  const [settings, profiles] = await Promise.all([
    runtime.settingsStore.get(),
    listGameScraperProfiles(runtime)
  ])
  const runState = await resolveImportRunState(runtime)
  const flow = runState.flow
  const step = resolveVniteImportStep({ flow, hasActiveRun: !!runState.activeRun })
  const diagnostics = collectDiagnostics(flow)
  const visibleDiagnostics = createVisibleDiagnostics(diagnostics)

  return {
    step,
    submitLabel: getVniteImportSubmitLabel(step),
    file: flow.file ? { name: flow.file.name, sizeLabel: formatBytes(flow.file.sizeBytes) } : null,
    options: toOptionsForm(settings, profiles),
    fieldSelection: settings.defaults.fieldSelection,
    selectedFieldCount: countSelectedFields(settings.defaults.fieldSelection),
    totalFieldCount: countAllFields(),
    profiles,
    preview: flow.preview ? toPreviewDto(flow) : null,
    run: runState.activeRun ? toRunDto(runState.activeRun, flow) : null,
    doneSummary: flow.lastSummary ? toDoneSummaryDto(flow.lastSummary) : null,
    diagnostics: toDiagnosticsTableRows(visibleDiagnostics).map((row) => ({
      level: row.level ?? '',
      subject: row.subject ?? '',
      message: row.message ?? ''
    })),
    diagnosticsTotal: visibleDiagnostics.length
  }
}

async function resolveImportRunState(runtime: VniteImportWizardRuntime): Promise<{
  flow: VniteImportFlowState
  activeRun?: ExtensionTaskRunSnapshot
}> {
  let flow = await runtime.flowStore.get()

  if (flow.activeRunId) {
    const activeRun = await runtime.taskRuns.getActiveOwn(flow.activeRunId)
    if (activeRun) {
      if (flow.step !== 'running') {
        flow = await runtime.flowStore.setStep('running')
      }
      return { flow, activeRun }
    }

    const finishedRun = await runtime.taskRuns.getHistoryOwn(flow.activeRunId)
    if (finishedRun) {
      const summary = readJobSummary(finishedRun)
      flow = summary
        ? await runtime.flowStore.setDone(summary)
        : await runtime.flowStore.clearActiveRun('done')
      return { flow }
    }

    flow = await runtime.flowStore.clearActiveRun('done')
  }

  const [activeRun] = await runtime.taskRuns.listActiveOwn({
    operations: ['vnite.import'],
    limit: 1
  })
  if (activeRun) {
    flow = await runtime.flowStore.setActiveRun(activeRun.id)
    return { flow, activeRun }
  }

  return { flow }
}

async function listGameScraperProfiles(runtime: VniteImportWizardRuntime) {
  try {
    const profiles = await runtime.scrapers.profiles.list({ mediaType: 'game' })
    return profiles.map((profile) => ({ value: profile.id, label: profile.name }))
  } catch (error) {
    runtime.logger.warn('Vnite importer failed to list scraper profiles.', toSafeLog(error))
    return []
  }
}

function toOptionsForm(
  settings: VniteImporterSettingsV1,
  profiles: readonly { value: string }[]
): VniteImportOptionsForm {
  const defaults = settings.defaults

  return {
    completeMetadata: defaults.completeMetadata,
    scraperProfileId: defaults.scraperProfileId ?? profiles[0]?.value ?? '',
    completionSurfacePreset: defaults.completionSurfacePreset,
    completionSurfaces: defaults.completionSurfaces,
    conflictMode: defaults.conflictMode,
    strictAttachments: defaults.strictAttachments
  }
}

async function persistOptions(
  runtime: VniteImportWizardRuntime,
  options: VniteImportOptionsForm
): Promise<VniteImporterSettingsV1> {
  return await runtime.settingsStore.update((settings) => ({
    ...settings,
    defaults: omitUndefined({
      ...settings.defaults,
      conflictMode: options.conflictMode,
      completeMetadata: options.completeMetadata,
      completionSurfacePreset: options.completionSurfacePreset,
      completionSurfaces: options.completionSurfaces,
      strictAttachments: options.strictAttachments,
      scraperProfileId: options.scraperProfileId || settings.defaults.scraperProfileId
    })
  }))
}

function toPreviewDto(flow: VniteImportFlowState): VnitePreviewDto {
  const preview = flow.preview
  if (!preview) {
    throw new Error('Preview state is missing.')
  }

  const counters = preview.summary.counters
  const plannedGames = preview.games.filter(
    (game) => game.action === 'create' || game.action === 'update'
  )
  const updateGames = preview.games.filter((game) => game.action === 'update')

  return {
    summary: {
      created: counters.gamesCreated,
      updated: counters.gamesUpdated,
      skipped: counters.gamesSkipped,
      errors: counters.errors ?? 0,
      warnings: counters.warnings ?? 0
    },
    writePlan: plannedGames.slice(0, WRITE_PLAN_ROW_LIMIT).map((game) => game.title),
    writePlanTotal: plannedGames.length,
    updates: updateGames.slice(0, UPDATE_PLAN_GROUP_LIMIT).map(toUpdatePlanGroup),
    updatesTotal: updateGames.length
  }
}

function toUpdatePlanGroup(game: VniteImportPreviewGame): VnitePreviewUpdateGroupDto {
  const rows = [
    {
      label: '资料',
      before: game.existing?.metadata ?? '-',
      after: formatMetadataPlan(game)
    },
    {
      label: '记录',
      before: game.existing?.activity ?? '-',
      after: formatParts([game.playStatus, game.score, game.playTime])
    },
    {
      label: '组织 / 媒体',
      before: game.existing?.organization ?? '-',
      after: formatParts([
        formatLabeledValue('合集', game.collections),
        formatLabeledValue('标签', game.tags),
        game.attachments,
        formatLabeledValue('路径', game.localPath)
      ])
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
              before:
                formatParts([
                  game.existing?.metadata,
                  game.existing?.activity,
                  game.existing?.organization
                ]) || '-',
              after: '按所选字段更新'
            }
          ]
  }
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

function toRunDto(run: ExtensionTaskRunSnapshot, flow: VniteImportFlowState) {
  return {
    statusLabel: run.progress?.phase?.label ?? run.status ?? flow.activeRunId ?? '正在刷新',
    counters: run.progress?.counters ?? {}
  }
}

function toDoneSummaryDto(summary: VniteImportJobSummary) {
  return {
    created: summary.counters.gamesCreated,
    updated: summary.counters.gamesUpdated,
    completionCompleted: summary.counters.completionCompleted,
    completionFailed: summary.counters.completionFailed,
    errors: summary.counters.errors ?? 0,
    warnings: summary.counters.warnings ?? 0
  }
}

function collectDiagnostics(flow: VniteImportFlowState): readonly VniteImportDiagnostic[] {
  if (flow.preview) {
    return [...flow.preview.analysis.diagnostics, ...flow.preview.summary.diagnostics]
  }

  return flow.lastSummary?.diagnostics ?? []
}

async function resetTransientFlow(runtime: VniteImportWizardRuntime): Promise<void> {
  const flow = await runtime.flowStore.get()
  if (flow.file) {
    await releaseGrant(runtime, flow.file.grantId)
  }
  await runtime.flowStore.reset()
}

async function releaseGrant(runtime: VniteImportWizardRuntime, grantId: string): Promise<void> {
  await runtime.files.releaseGrant(grantId).catch((error) => {
    runtime.logger.warn('Vnite importer failed to release file grant.', toSafeLog(error))
  })
}

async function withLoadingNotification<T>(
  runtime: VniteImportWizardRuntime,
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
        runtime.logger.warn('Vnite importer failed to show loading notification.', toSafeLog(error))
        return undefined
      })
    notificationId = handle?.id

    return await input.run()
  } finally {
    if (notificationId) {
      await runtime.notify.dismiss(notificationId).catch((error) => {
        runtime.logger.warn(
          'Vnite importer failed to dismiss loading notification.',
          toSafeLog(error)
        )
      })
    }
  }
}

function requireFileGrant(
  file: VniteStoredFileGrant | undefined
): Pick<ExtensionFileGrant, 'grantId' | 'name' | 'path' | 'sizeBytes'> {
  if (!file) {
    throw new Error('请先选择 Vnite 备份包。')
  }

  return file
}

function validateCompletionOptions(options: VniteImportOptionsForm): void {
  if (options.completeMetadata && !options.scraperProfileId) {
    throw new Error('请先选择刮削配置，或关闭补全。')
  }
}

function readJobSummary(run: ExtensionTaskRunSnapshot): VniteImportJobSummary | undefined {
  const output = run.result?.output
  return isRecord(output) && isRecord(output.counters)
    ? (output as unknown as VniteImportJobSummary)
    : undefined
}

function formatBytes(value: number): string {
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

function formatParts(parts: readonly (string | undefined)[]): string {
  const normalized = parts.filter((part): part is string => !!part)
  return normalized.length ? normalized.join(' / ') : '-'
}

function formatLabeledValue(label: string, value: string | undefined): string | undefined {
  return value ? `${label} ${value}` : undefined
}

function toSafeLog(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `vnite-import:${Date.now()}`
}
