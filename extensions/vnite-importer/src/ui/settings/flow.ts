import type {
  ExtensionFileGrant,
  ExtensionStorage,
  LibraryGraphResult
} from '@kisaki3/extension-sdk'
import { VNITE_IMPORTER_STORAGE_KEYS } from '../../shared/constants'
import type { VniteBackupAnalysisSummary } from '../../backup/types'
import type { VniteImportExecutionSummary, VniteImportJobSummary } from '../../import/summary'

export type VniteImportStep = 'pickBackup' | 'configureImport' | 'previewGraph' | 'running' | 'done'

export interface VniteStoredFileGrant {
  grantId: string
  name: string
  sizeBytes: number
  path: string
}

export interface VniteImportPreviewState {
  createdAt: number
  analysis: VniteBackupAnalysisSummary
  graph: LibraryGraphResult
  summary: VniteImportExecutionSummary
}

export interface VniteImportFlowState {
  version: 1
  step: VniteImportStep
  file?: VniteStoredFileGrant
  analysis?: VniteBackupAnalysisSummary
  preview?: VniteImportPreviewState
  activeRunId?: string
  lastSummary?: VniteImportJobSummary
  updatedAt: number
}

export class VniteImportFlowStore {
  constructor(private readonly storage: ExtensionStorage) {}

  async get(): Promise<VniteImportFlowState> {
    return normalizeFlowState(await this.storage.get(VNITE_IMPORTER_STORAGE_KEYS.flow))
  }

  async set(state: VniteImportFlowState): Promise<VniteImportFlowState> {
    const normalized = normalizeFlowState(state)
    await this.storage.set(VNITE_IMPORTER_STORAGE_KEYS.flow, normalized)
    return normalized
  }

  async setFileGrant(
    grant: Pick<ExtensionFileGrant, 'grantId' | 'name' | 'sizeBytes' | 'path'>,
    step: VniteImportStep = 'pickBackup'
  ) {
    return await this.set({
      version: 1,
      step,
      file: {
        grantId: grant.grantId,
        name: grant.name,
        sizeBytes: grant.sizeBytes,
        path: grant.path
      },
      updatedAt: Date.now()
    })
  }

  async setStep(step: VniteImportStep): Promise<VniteImportFlowState> {
    return await this.update((state) => ({
      ...state,
      step,
      updatedAt: Date.now()
    }))
  }

  async setAnalysis(analysis: VniteBackupAnalysisSummary): Promise<VniteImportFlowState> {
    return await this.update((state) => {
      const rest = { ...state }
      delete rest.preview
      return {
        ...rest,
        step: 'configureImport',
        analysis,
        updatedAt: Date.now()
      }
    })
  }

  async setPreview(preview: VniteImportPreviewState): Promise<VniteImportFlowState> {
    return await this.update((state) => ({
      ...state,
      step: 'previewGraph',
      analysis: preview.analysis,
      preview,
      updatedAt: Date.now()
    }))
  }

  async setActiveRun(runId: string): Promise<VniteImportFlowState> {
    return await this.update((state) => ({
      ...state,
      step: 'running',
      activeRunId: runId,
      updatedAt: Date.now()
    }))
  }

  async setDone(summary: VniteImportJobSummary): Promise<VniteImportFlowState> {
    return await this.update((state) => {
      const rest = { ...state }
      delete rest.activeRunId
      return {
        ...rest,
        step: 'done',
        lastSummary: summary,
        updatedAt: Date.now()
      }
    })
  }

  async clearActiveRun(step: VniteImportStep = 'done'): Promise<VniteImportFlowState> {
    return await this.update((state) => {
      const rest = { ...state }
      delete rest.activeRunId
      return {
        ...rest,
        step,
        updatedAt: Date.now()
      }
    })
  }

  async reset(options: { keepLastSummary?: boolean } = {}): Promise<VniteImportFlowState> {
    const previous = await this.get()
    const state: VniteImportFlowState = {
      version: 1,
      step: 'pickBackup',
      updatedAt: Date.now()
    }
    if (options.keepLastSummary && previous.lastSummary) {
      state.lastSummary = previous.lastSummary
    }
    return await this.set(state)
  }

  private async update(
    update: (state: VniteImportFlowState) => VniteImportFlowState
  ): Promise<VniteImportFlowState> {
    return await this.set(update(await this.get()))
  }
}

export function resolveVniteImportStep(input: {
  flow: VniteImportFlowState
  hasActiveRun: boolean
}): VniteImportStep {
  const flow = input.flow
  if (input.hasActiveRun) {
    return 'running'
  }
  if (flow.step === 'done') {
    return 'done'
  }
  if (!flow.file) {
    return 'pickBackup'
  }
  if (flow.step === 'pickBackup') {
    return 'pickBackup'
  }
  if (!flow.analysis && !flow.preview) {
    return 'pickBackup'
  }
  if (flow.step === 'previewGraph' && flow.preview) {
    return 'previewGraph'
  }
  if (flow.step === 'running') {
    return 'running'
  }
  return 'configureImport'
}

export function getVniteImportSubmitLabel(step: VniteImportStep): string {
  switch (step) {
    case 'pickBackup':
      return '下一步'
    case 'configureImport':
      return '生成预览'
    case 'previewGraph':
      return '开始导入'
    case 'running':
      return '刷新状态'
    case 'done':
      return '导入另一个备份包'
  }
}

function normalizeFlowState(value: unknown): VniteImportFlowState {
  if (!isRecord(value) || value.version !== 1) {
    return createEmptyFlowState()
  }

  const step = normalizeStep(value.step)
  const normalized: VniteImportFlowState = {
    version: 1,
    step,
    updatedAt: normalizeTimestamp(value.updatedAt)
  }
  const file = normalizeFile(value.file)
  const preview = normalizePreview(value.preview)
  const activeRunId = normalizeOptionalString(value.activeRunId)

  if (file) {
    normalized.file = file
  }
  if (isRecord(value.analysis)) {
    normalized.analysis = value.analysis as unknown as VniteBackupAnalysisSummary
  }
  if (preview) {
    normalized.preview = preview
  }
  if (activeRunId) {
    normalized.activeRunId = activeRunId
  }
  if (isRecord(value.lastSummary)) {
    normalized.lastSummary = value.lastSummary as unknown as VniteImportJobSummary
  }

  return normalized
}

function createEmptyFlowState(): VniteImportFlowState {
  return {
    version: 1,
    step: 'pickBackup',
    updatedAt: Date.now()
  }
}

function normalizeStep(value: unknown): VniteImportStep {
  switch (value) {
    case 'pickBackup':
    case 'configureImport':
    case 'previewGraph':
    case 'running':
    case 'done':
      return value
    case 'analyzeBackup':
      return 'pickBackup'
    default:
      return 'pickBackup'
  }
}

function normalizeFile(value: unknown): VniteStoredFileGrant | undefined {
  const input = isRecord(value) ? value : undefined
  const grantId = normalizeOptionalString(input?.grantId)
  const name = normalizeOptionalString(input?.name)
  const path = normalizeOptionalString(input?.path)
  const sizeBytes = normalizeNumber(input?.sizeBytes)

  if (!grantId || !name || !path || sizeBytes === undefined) {
    return undefined
  }

  return { grantId, name, path, sizeBytes }
}

function normalizePreview(value: unknown): VniteImportPreviewState | undefined {
  const input = isRecord(value) ? value : undefined
  if (!input || !isRecord(input.analysis) || !isRecord(input.graph) || !isRecord(input.summary)) {
    return undefined
  }

  return {
    createdAt: normalizeTimestamp(input.createdAt),
    analysis: input.analysis as unknown as VniteBackupAnalysisSummary,
    graph: input.graph as unknown as LibraryGraphResult,
    summary: input.summary as unknown as VniteImportExecutionSummary
  }
}

function normalizeTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : Date.now()
}

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed || undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
