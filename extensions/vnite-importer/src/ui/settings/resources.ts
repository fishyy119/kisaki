import type { ExtensionTaskRunSnapshot, ScraperProfileSummary } from '@kisaki3/extension-sdk'
import type { VniteImporterSettingsV1 } from '../../config'
import type { VniteImportJobSummary } from '../../import/summary'
import type { VniteImportFlowState } from './flow'
import type { VniteSettingsRuntime } from './runtime'

export interface VniteSettingsResourceSnapshot {
  settings: VniteImporterSettingsV1
  flow: VniteImportFlowState
  profiles: readonly ScraperProfileSummary[]
  activeRun?: ExtensionTaskRunSnapshot
  finishedRun?: ExtensionTaskRunSnapshot
}

export async function resolveVniteSettingsResources(
  runtime: VniteSettingsRuntime
): Promise<VniteSettingsResourceSnapshot> {
  const [settings, profiles] = await Promise.all([
    runtime.settingsStore.get(),
    listGameScraperProfiles(runtime)
  ])
  const runState = await resolveImportRunState(runtime)

  return {
    settings,
    flow: runState.flow,
    profiles,
    activeRun: runState.activeRun,
    finishedRun: runState.finishedRun
  }
}

async function listGameScraperProfiles(
  runtime: VniteSettingsRuntime
): Promise<readonly ScraperProfileSummary[]> {
  try {
    return await runtime.scrapers.profiles.list({ mediaType: 'game' })
  } catch (error) {
    runtime.logger.warn('Vnite importer failed to list scraper profiles.', toSafeLog(error))
    return []
  }
}

async function resolveImportRunState(runtime: VniteSettingsRuntime): Promise<{
  flow: VniteImportFlowState
  activeRun?: ExtensionTaskRunSnapshot
  finishedRun?: ExtensionTaskRunSnapshot
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
      return { flow, finishedRun }
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

function readJobSummary(run: ExtensionTaskRunSnapshot): VniteImportJobSummary | undefined {
  const output = run.result?.output
  return isRecord(output) && isRecord(output.counters)
    ? (output as unknown as VniteImportJobSummary)
    : undefined
}

function toSafeLog(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    }
  }

  return {
    message: String(error)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
