import type { TaskRunSnapshot } from '@kisaki3/extension-sdk'
import type {
  VniteDoneSummaryDto,
  VniteImportOptionsForm,
  VnitePreviewDto,
  VnitePreviewUpdateGroupDto,
  VniteRunDto,
  VniteWizardState
} from '../../shared/import-wizard'
import type { VniteImportDiagnostic } from '../backup/types'
import type { VniteImporterSettingsV1 } from '../config'
import type { VniteImportReport } from '../jobs/report'
import { createVisibleDiagnostics, toDiagnosticsTableRows } from './diagnostics'
import type { VniteImportPreviewGame } from './preview-games'
import type { VniteWizardPreview, VniteWizardSession } from './session'
import { resolveVniteImportStep, type VniteImportFlowState } from './store'
import type { VniteImportWizardRuntime } from './runtime'

const WRITE_PLAN_ROW_LIMIT = 120
const UPDATE_PLAN_GROUP_LIMIT = 40

/**
 * Computes the full wizard state from persisted flow, session preview, and
 * the live task run, and records it on the session so progress pushes can
 * patch it in place.
 */
export async function resolveWizardState(
  runtime: VniteImportWizardRuntime,
  session: VniteWizardSession
): Promise<VniteWizardState> {
  const [settings, profiles] = await Promise.all([
    runtime.settingsStore.get(),
    listGameScraperProfiles(runtime)
  ])
  const runState = await resolveImportRunState(runtime)
  const flow = runState.flow
  const step = resolveVniteImportStep({
    flow,
    hasActiveRun: !!runState.activeRun,
    hasPreview: !!session.preview
  })
  const diagnostics = collectDiagnostics(flow, session)
  const visibleDiagnostics = createVisibleDiagnostics(diagnostics)

  const state: VniteWizardState = {
    step,
    file: flow.file ? { name: flow.file.name, sizeBytes: flow.file.sizeBytes } : null,
    options: toOptionsForm(settings, profiles),
    fieldSelection: settings.defaults.fieldSelection,
    profiles,
    preview: session.preview ? toPreviewDto(session.preview) : null,
    run: runState.activeRun ? toRunDto(runState.activeRun) : null,
    doneSummary: flow.lastReport ? toDoneSummaryDto(flow.lastReport) : null,
    diagnostics: toDiagnosticsTableRows(visibleDiagnostics).map((row) => ({
      level: row.level ?? '',
      subject: row.subject ?? '',
      message: row.message ?? ''
    })),
    diagnosticsTotal: visibleDiagnostics.length
  }

  session.rememberState(state)
  return state
}

/**
 * Reconciles the persisted flow with the actual run state. Terminal runs are
 * resolved from the extension's own report (written by the job lifecycle);
 * a run that vanished without one (host recycle) drops back to configuration.
 */
export async function resolveImportRunState(runtime: VniteImportWizardRuntime): Promise<{
  flow: VniteImportFlowState
  activeRun?: TaskRunSnapshot
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

    flow =
      flow.lastReport?.runId === flow.activeRunId
        ? await runtime.flowStore.setDone(flow.lastReport)
        : await runtime.flowStore.clearActiveRun()
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

export function toOptionsForm(
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

async function listGameScraperProfiles(
  runtime: VniteImportWizardRuntime
): Promise<readonly { value: string; label: string }[]> {
  try {
    const profiles = await runtime.scrapers.profiles.list({ mediaType: 'game' })
    return profiles.map((profile) => ({ value: profile.id, label: profile.name }))
  } catch (error) {
    runtime.logger.warn('Vnite importer failed to list scraper profiles.', {
      message: error instanceof Error ? error.message : String(error)
    })
    return []
  }
}

function collectDiagnostics(
  flow: VniteImportFlowState,
  session: VniteWizardSession
): readonly VniteImportDiagnostic[] {
  if (session.preview) {
    return [...session.preview.analysis.diagnostics, ...session.preview.summary.diagnostics]
  }

  return flow.lastReport?.diagnostics ?? []
}

function toPreviewDto(preview: VniteWizardPreview): VnitePreviewDto {
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

function toRunDto(run: TaskRunSnapshot): VniteRunDto {
  return {
    status: run.status,
    phaseLabel: run.progress?.phase?.label ?? null,
    counters: run.progress?.counters ?? {}
  }
}

function toDoneSummaryDto(report: VniteImportReport): VniteDoneSummaryDto {
  return {
    status: report.status,
    fileName: report.fileName,
    created: report.counters.gamesCreated,
    updated: report.counters.gamesUpdated,
    completionCompleted: report.counters.completionCompleted,
    completionFailed: report.counters.completionFailed,
    errors: report.counters.errors ?? 0,
    warnings: report.counters.warnings ?? 0
  }
}

function formatParts(parts: readonly (string | undefined)[]): string {
  const normalized = parts.filter((part): part is string => !!part)
  return normalized.length ? normalized.join(' / ') : '-'
}

function formatLabeledValue(label: string, value: string | undefined): string | undefined {
  return value ? `${label} ${value}` : undefined
}
