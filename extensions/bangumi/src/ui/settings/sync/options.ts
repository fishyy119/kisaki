import type { SerializableRecord } from '@kisaki/extension-sdk'
import type { BangumiSettingsV1 } from '../../../config/schema'
import { SETTINGS_NODE_IDS } from '../ids'
import { pickKnownValues, readStringArray } from '../shared/values'

export type AutoSyncItem = 'create' | 'status' | 'score'
export type FullSyncItem = 'status' | 'score'

const AUTO_SYNC_ITEMS = ['create', 'status', 'score'] as const satisfies readonly AutoSyncItem[]
const FULL_SYNC_ITEMS = ['status', 'score'] as const satisfies readonly FullSyncItem[]

export function readAutoSyncItems(
  values: Record<string, unknown>,
  storedSettings: BangumiSettingsV1
): readonly AutoSyncItem[] {
  return pickKnownValues(
    readStringArray(values, SETTINGS_NODE_IDS.autoSyncItems, createAutoSyncItems(storedSettings)),
    AUTO_SYNC_ITEMS
  )
}

export function readFullSyncItems(
  values: Record<string, unknown>,
  storedSettings: BangumiSettingsV1
): readonly FullSyncItem[] {
  return pickKnownValues(
    readStringArray(values, SETTINGS_NODE_IDS.fullSyncItems, createFullSyncItems(storedSettings)),
    FULL_SYNC_ITEMS
  )
}

export function createAutoSyncFlags(items: readonly AutoSyncItem[]): {
  syncOnCreate: boolean
  playStatusEnabled: boolean
  scoreEnabled: boolean
} {
  return {
    syncOnCreate: items.includes('create'),
    playStatusEnabled: items.includes('status'),
    scoreEnabled: items.includes('score')
  }
}

export function createFullSyncItemArgs(items: readonly FullSyncItem[]): SerializableRecord {
  return {
    playStatusEnabled: items.includes('status'),
    scoreEnabled: items.includes('score')
  }
}

function createAutoSyncItems(settings: BangumiSettingsV1): readonly AutoSyncItem[] {
  return [
    settings.autoSync.syncOnCreate ? 'create' : undefined,
    settings.autoSync.playStatusEnabled ? 'status' : undefined,
    settings.autoSync.scoreEnabled ? 'score' : undefined
  ].filter((item): item is AutoSyncItem => !!item)
}

function createFullSyncItems(settings: BangumiSettingsV1): readonly FullSyncItem[] {
  return [
    settings.autoSync.playStatusEnabled ? 'status' : undefined,
    settings.autoSync.scoreEnabled ? 'score' : undefined
  ].filter((item): item is FullSyncItem => !!item)
}
