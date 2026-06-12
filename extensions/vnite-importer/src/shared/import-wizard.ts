import type { GameUpdateSurface, LibraryGraphConflictMode } from '@kisaki3/extension-sdk'

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

export interface VniteFieldItemDto {
  key: string
  label: string
}

export interface VniteFieldGroupDto {
  key: keyof VniteImportFieldSelection
  label: string
  description: string
  items: readonly VniteFieldItemDto[]
}

export const VNITE_FIELD_GROUPS: readonly VniteFieldGroupDto[] = [
  {
    key: 'core',
    label: '基础信息',
    description: '名称、简介、日期、外部 ID 和分级',
    items: [
      { key: 'name', label: '名称' },
      { key: 'originalName', label: '原名' },
      { key: 'sortName', label: '排序名' },
      { key: 'releaseDate', label: '发售日期' },
      { key: 'description', label: '简介' },
      { key: 'relatedSites', label: '相关网站' },
      { key: 'externalIds', label: '外部 ID' },
      { key: 'nsfw', label: 'NSFW 标记' }
    ]
  },
  {
    key: 'local',
    label: '本地启动',
    description: '启动器、游戏目录和存档路径',
    items: [
      { key: 'launcher', label: '启动配置' },
      { key: 'gameDirPath', label: '游戏目录' },
      { key: 'savePath', label: '存档路径' }
    ]
  },
  {
    key: 'activity',
    label: '游玩记录',
    description: '状态、评分、时长、会话和添加时间',
    items: [
      { key: 'status', label: '游玩状态' },
      { key: 'score', label: '评分' },
      { key: 'totalDuration', label: '总游玩时长' },
      { key: 'lastActiveAt', label: '最后游玩时间' },
      { key: 'sessions', label: '游玩会话' },
      { key: 'createdAt', label: '添加时间' }
    ]
  },
  {
    key: 'organization',
    label: '分类与标签',
    description: '合集、标签、题材和平台',
    items: [
      { key: 'collections', label: '合集' },
      { key: 'tags', label: '标签' },
      { key: 'genresAsTags', label: '题材作为标签' },
      { key: 'platformsAsTags', label: '平台作为标签' }
    ]
  },
  {
    key: 'credits',
    label: '制作方与人员',
    description: '开发商、发行商和 extra 人员',
    items: [
      { key: 'companies', label: '制作方' },
      { key: 'personsFromExtra', label: 'extra 人员' },
      { key: 'unknownExtraAsNotes', label: '未知 extra 写入备注' }
    ]
  },
  {
    key: 'media',
    label: '媒体',
    description: '封面、背景图、Logo、图标和简介图片',
    items: [
      { key: 'cover', label: '封面' },
      { key: 'backdrop', label: '背景图' },
      { key: 'logo', label: 'Logo' },
      { key: 'icon', label: '图标' },
      { key: 'descriptionImages', label: '简介图片' }
    ]
  },
  {
    key: 'saves',
    label: '存档',
    description: '存档备份和最大备份数',
    items: [
      { key: 'saveBackups', label: '存档备份' },
      { key: 'maxSaveBackups', label: '最大备份数' }
    ]
  },
  {
    key: 'memories',
    label: '回忆',
    description: '回忆记录和回忆图片',
    items: [
      { key: 'notes', label: '回忆记录' },
      { key: 'noteImages', label: '回忆图片' }
    ]
  }
]

export function countSelectedFields(selection: VniteImportFieldSelection): number {
  return Object.values(selection).reduce(
    (sum, group) => sum + Object.values(group).filter(Boolean).length,
    0
  )
}

export function countAllFields(): number {
  return VNITE_FIELD_GROUPS.reduce((sum, group) => sum + group.items.length, 0)
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
  statusLabel: string
  counters: Record<string, number>
}

export interface VniteDoneSummaryDto {
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
  submitLabel: string
  file: { name: string; sizeLabel: string } | null
  options: VniteImportOptionsForm
  fieldSelection: VniteImportFieldSelection
  selectedFieldCount: number
  totalFieldCount: number
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

export type VniteImportWizardUiFunctions = Record<string, never>
