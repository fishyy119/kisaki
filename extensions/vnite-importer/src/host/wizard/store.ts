import type {
  ExtensionFileGrant,
  ExtensionStorage,
  LibraryGraphResult,
  LibraryGraphResultAction
} from '@kisaki3/extension-sdk'
import { VNITE_IMPORTER_STORAGE_KEYS } from '../utils/constants'
import type { VniteImportStep } from '../../shared/import-wizard'
import type { VniteBackupAnalysisSummary } from '../backup/types'
import type { VniteImportExecutionSummary, VniteImportJobSummary } from '../import/summary'

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
  games: readonly VniteImportPreviewGame[]
}

export interface VniteImportPreviewGame {
  key: string
  title: string
  subtitle?: string
  action: LibraryGraphResultAction
  entityId?: string
  existing?: VniteImportPreviewExistingGame
  name?: string
  originalName?: string
  releaseDate?: string
  developers?: string
  publishers?: string
  platforms?: string
  genres?: string
  tags?: string
  collections?: string
  playStatus?: string
  playTime?: string
  score?: string
  localPath?: string
  attachments?: string
}

export interface VniteImportPreviewExistingGame {
  metadata?: string
  activity?: string
  organization?: string
}

export interface VniteImportFlowState {
  version: 1
  step: VniteImportStep
  file?: VniteStoredFileGrant
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

  async setPreview(preview: VniteImportPreviewState): Promise<VniteImportFlowState> {
    return await this.update((state) => ({
      ...state,
      step: 'preview',
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

  async reset(): Promise<VniteImportFlowState> {
    return await this.set({
      version: 1,
      step: 'pickBackup',
      updatedAt: Date.now()
    })
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
  if (flow.step === 'preview' && flow.preview) {
    return 'preview'
  }
  if (flow.step === 'running') {
    return 'running'
  }
  return 'config'
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
    case 'config':
    case 'preview':
    case 'running':
    case 'done':
      return value
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
    summary: input.summary as unknown as VniteImportExecutionSummary,
    games: normalizePreviewGames(input.games)
  }
}

function normalizePreviewGames(value: unknown): readonly VniteImportPreviewGame[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    const normalized = normalizePreviewGame(item)
    return normalized ? [normalized] : []
  })
}

function normalizePreviewGame(value: unknown): VniteImportPreviewGame | undefined {
  const input = isRecord(value) ? value : undefined
  const key = normalizeOptionalString(input?.key)
  const title = normalizeOptionalString(input?.title)
  const action = normalizePreviewAction(input?.action)

  if (!key || !title || !action) {
    return undefined
  }

  const game: VniteImportPreviewGame = { key, title, action }
  assignOptionalString(game, 'entityId', input?.entityId)
  assignOptionalExistingGame(game, input?.existing)
  assignOptionalString(game, 'subtitle', input?.subtitle)
  assignOptionalString(game, 'name', input?.name)
  assignOptionalString(game, 'originalName', input?.originalName)
  assignOptionalString(game, 'releaseDate', input?.releaseDate)
  assignOptionalString(game, 'developers', input?.developers)
  assignOptionalString(game, 'publishers', input?.publishers)
  assignOptionalString(game, 'platforms', input?.platforms)
  assignOptionalString(game, 'genres', input?.genres)
  assignOptionalString(game, 'tags', input?.tags)
  assignOptionalString(game, 'collections', input?.collections)
  assignOptionalString(game, 'playStatus', input?.playStatus)
  assignOptionalString(game, 'playTime', input?.playTime)
  assignOptionalString(game, 'score', input?.score)
  assignOptionalString(game, 'localPath', input?.localPath)
  assignOptionalString(game, 'attachments', input?.attachments)
  return game
}

function assignOptionalExistingGame(target: VniteImportPreviewGame, value: unknown): void {
  const input = isRecord(value) ? value : undefined
  if (!input) {
    return
  }

  const existing: VniteImportPreviewExistingGame = {}
  assignOptionalString(existing, 'metadata', input.metadata)
  assignOptionalString(existing, 'activity', input.activity)
  assignOptionalString(existing, 'organization', input.organization)

  if (Object.keys(existing).length > 0) {
    target.existing = existing
  }
}

function normalizePreviewAction(value: unknown): LibraryGraphResultAction | undefined {
  switch (value) {
    case 'create':
    case 'update':
    case 'skip':
    case 'fail':
      return value
    default:
      return undefined
  }
}

function assignOptionalString<TTarget extends object, TKey extends keyof TTarget>(
  target: TTarget,
  key: TKey,
  value: unknown
): void {
  const normalized = normalizeOptionalString(value)
  if (normalized) {
    Object.assign(target, { [key]: normalized })
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
