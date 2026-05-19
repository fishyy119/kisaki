import { SETTINGS_DIALOG_IDS } from './ids'
import type { BangumiSettingsRuntime } from './runtime'
import { createIndexDialog } from './import/index-dialog'
import { createMyCollectionsDialog } from './import/my-collections-dialog'
import { createFullSyncDialog } from './sync/full-sync-dialog'

export function createSettingsDialogs(runtime: BangumiSettingsRuntime) {
  return {
    [SETTINGS_DIALOG_IDS.fullSync]: createFullSyncDialog(runtime),
    [SETTINGS_DIALOG_IDS.importMyCollections]: createMyCollectionsDialog(runtime),
    [SETTINGS_DIALOG_IDS.importIndex]: createIndexDialog(runtime)
  } as const
}

export type BangumiSettingsDialogs = ReturnType<typeof createSettingsDialogs>
