export const VNITE_SETTINGS_DIALOG_IDS = {
  fields: 'fields',
  diagnostics: 'diagnostics'
} as const

export const VNITE_SETTINGS_NODE_IDS = {
  completeMetadata: 'completeMetadata',
  scraperProfileId: 'scraperProfileId',
  completionSurfacePreset: 'completionSurfacePreset',
  completionSurfaces: 'completionSurfaces',
  conflictMode: 'conflictMode',
  strictAttachments: 'strictAttachments',
  pickBackupFile: 'pickBackupFile',
  editFields: 'editFields',
  chooseAnotherBackup: 'chooseAnotherBackup',
  backToConfigure: 'backToConfigure',
  refreshPreview: 'refreshPreview',
  viewDiagnostics: 'viewDiagnostics'
} as const

export type VniteSettingsDialogId =
  (typeof VNITE_SETTINGS_DIALOG_IDS)[keyof typeof VNITE_SETTINGS_DIALOG_IDS]
