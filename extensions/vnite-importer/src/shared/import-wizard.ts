import type {
  TaskRunStatus,
  GameUpdateSurface,
  LibraryGraphConflictMode
} from '@kisaki3/extension-sdk'

export type VniteImportStep = 'pickBackup' | 'config' | 'preview' | 'running' | 'done'

export interface VniteImportFieldSelection {
  core: {
    name: boolean
    originalName: boolean
    sortName: boolean
    releaseDate: boolean
    description: boolean
    relatedSites: boolean
    externalIds: boolean
    nsfw: boolean
  }
  local: {
    launcher: boolean
    gameDirPath: boolean
    savePath: boolean
  }
  activity: {
    status: boolean
    score: boolean
    totalDuration: boolean
    lastActiveAt: boolean
    sessions: boolean
    createdAt: boolean
  }
  organization: {
    collections: boolean
    tags: boolean
    genresAsTags: boolean
    platformsAsTags: boolean
  }
  credits: {
    companies: boolean
    personsFromExtra: boolean
    unknownExtraAsNotes: boolean
  }
  media: {
    cover: boolean
    backdrop: boolean
    logo: boolean
    icon: boolean
    descriptionImages: boolean
  }
  saves: {
    saveBackups: boolean
    maxSaveBackups: boolean
  }
  memories: {
    notes: boolean
    noteImages: boolean
  }
}

export type PartialVniteImportFieldSelection = {
  [TGroup in keyof VniteImportFieldSelection]?: Partial<VniteImportFieldSelection[TGroup]>
}

/**
 * Webview RPC contract between the extension host entry and the import wizard
 * webview document. Both sides live in this project and import these types
 * directly.
 */

export const VNITE_IMPORT_WIZARD_ENTRY = 'import/index.html'

export type VniteCompletionSurfacePresetValue = 'missingCoreAndMedia' | 'missingAll' | 'custom'

export interface VniteImportOptionsForm {
  completeMetadata: boolean
  scraperProfileId: string
  completionSurfacePreset: VniteCompletionSurfacePresetValue
  completionSurfaces: readonly GameUpdateSurface[]
  conflictMode: LibraryGraphConflictMode
  strictAttachments: boolean
}

export interface VnitePreviewSummaryDto {
  created: number
  updated: number
  skipped: number
  errors: number
  warnings: number
}

export interface VnitePreviewUpdateRowDto {
  label: string
  before: string
  after: string
}

export interface VnitePreviewUpdateGroupDto {
  id: string
  title: string
  rows: readonly VnitePreviewUpdateRowDto[]
}

export interface VnitePreviewDto {
  summary: VnitePreviewSummaryDto
  writePlan: readonly string[]
  writePlanTotal: number
  updates: readonly VnitePreviewUpdateGroupDto[]
  updatesTotal: number
}

export interface VniteRunDto {
  status: TaskRunStatus
  /**
   * Current phase label reported by the import job, when available. The UI
   * owns the fallback wording for bare statuses.
   */
  phaseLabel: string | null
  counters: Record<string, number>
}

export type VniteImportRunStatusDto = 'completed' | 'failed' | 'cancelled'

export interface VniteDoneSummaryDto {
  status: VniteImportRunStatusDto
  fileName: string
  created: number
  updated: number
  completionCompleted: number
  completionFailed: number
  errors: number
  warnings: number
}

export interface VniteDiagnosticRowDto {
  level: string
  subject: string
  message: string
}

export interface VniteWizardState {
  step: VniteImportStep
  file: { name: string; sizeBytes: number } | null
  options: VniteImportOptionsForm
  fieldSelection: VniteImportFieldSelection
  profiles: readonly { value: string; label: string }[]
  preview: VnitePreviewDto | null
  run: VniteRunDto | null
  doneSummary: VniteDoneSummaryDto | null
  diagnostics: readonly VniteDiagnosticRowDto[]
  diagnosticsTotal: number
}

/**
 * Functions the extension host exposes to the wizard webview.
 */
export interface VniteImportWizardHostFunctions {
  getState(): Promise<VniteWizardState>
  pickBackupFile(): Promise<VniteWizardState>
  goToConfig(): Promise<VniteWizardState>
  backToConfig(): Promise<VniteWizardState>
  resetFlow(): Promise<VniteWizardState>
  saveFieldSelection(selection: VniteImportFieldSelection): Promise<VniteWizardState>
  generatePreview(options: VniteImportOptionsForm): Promise<VniteWizardState>
  startImport(options: VniteImportOptionsForm): Promise<VniteWizardState>
}

/**
 * Functions the wizard webview exposes to the extension host. The import job
 * runs in this same host process, so live run progress is pushed straight
 * into the document instead of being polled.
 */
export interface VniteImportWizardUiFunctions {
  stateChanged(state: VniteWizardState): void
}
