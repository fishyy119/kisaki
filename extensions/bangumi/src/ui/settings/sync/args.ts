import type { SerializableRecord } from '@kisaki3/extension-sdk'
import type { BangumiSettingsV1 } from '../../../config/schema'
import { SETTINGS_NODE_IDS } from '../ids'
import { readBoolean, readNumber } from '../shared/values'
import { createFullSyncItemArgs, readFullSyncItems } from './options'

export function createFullSyncArgs(
  values: SerializableRecord,
  storedSettings: BangumiSettingsV1,
  dryRun: boolean
): SerializableRecord {
  const items = readFullSyncItems(values, storedSettings)
  const itemArgs = createFullSyncItemArgs(items)
  const updateExisting = readBoolean(values, SETTINGS_NODE_IDS.fullSyncUpdateExisting, true)
  const scoreEnabled = itemArgs.scoreEnabled === true

  return {
    scope: 'game',
    dryRun,
    updateExisting,
    ...itemArgs,
    clearRemoteScoreWhenEmpty:
      updateExisting &&
      scoreEnabled &&
      readBoolean(values, SETTINGS_NODE_IDS.fullSyncClearRemoteScoreWhenEmpty, false),
    batchSize: readNumber(values, SETTINGS_NODE_IDS.fullSyncBatchSize, 100)
  }
}
