export const VNITE_SETTINGS_DIALOG_IDS = {
  fields: 'fields',
  advanced: 'advanced'
} as const

export const VNITE_SETTINGS_NODE_IDS = {
  completeMetadata: 'completeMetadata',
  scraperProfileId: 'scraperProfileId',
  completionSurfacePreset: 'completionSurfacePreset',
  completionSurfaces: 'completionSurfaces',
  conflictMode: 'conflictMode',
  editFields: 'editFields',
  advancedOptions: 'advancedOptions',
  chooseAnotherBackup: 'chooseAnotherBackup',
  backToConfigure: 'backToConfigure',
  refreshPreview: 'refreshPreview',
  resetFlow: 'resetFlow',
  keepLastAnalysis: 'keepLastAnalysis',
  strictAttachments: 'strictAttachments',
  cleanupCurrentState: 'cleanupCurrentState'
} as const

export type VniteSettingsDialogId =
  (typeof VNITE_SETTINGS_DIALOG_IDS)[keyof typeof VNITE_SETTINGS_DIALOG_IDS]
