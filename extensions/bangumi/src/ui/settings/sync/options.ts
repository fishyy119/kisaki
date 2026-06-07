import type { JsonObject } from '@kisaki3/extension-sdk'
import type { BangumiSettingsV1 } from '../../../config/schema'
import type { BangumiMediaScope } from '../../../media/scopes'
import { SETTINGS_NODE_IDS } from '../ids'
import { pickKnownValues, readString, readStringArray } from '../shared/values'

export type AutoSyncItem = 'create' | 'status' | 'score'
export type FullSyncItem = 'status' | 'score'

export const AUTO_SYNC_ITEM_OPTIONS = [
  { value: 'create', label: '新增游戏' },
  { value: 'status', label: '游玩状态' },
  { value: 'score', label: '评分' }
] as const

export const FULL_SYNC_ITEM_OPTIONS = [
  { value: 'status', label: '游玩状态' },
  { value: 'score', label: '评分' }
] as const

const AUTO_SYNC_ITEMS = ['create', 'status', 'score'] as const satisfies readonly AutoSyncItem[]
const FULL_SYNC_ITEMS = ['status', 'score'] as const satisfies readonly FullSyncItem[]

export function readSyncScope(values: Record<string, unknown>): BangumiMediaScope {
  const value = readString(values, SETTINGS_NODE_IDS.syncScope, 'game')
  return value === 'game' ? value : 'game'
}

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

export function createFullSyncItemArgs(items: readonly FullSyncItem[]): JsonObject {
  return {
    playStatusEnabled: items.includes('status'),
    scoreEnabled: items.includes('score')
  }
}

function createAutoSyncItems(settings: BangumiSettingsV1): readonly AutoSyncItem[] {
  return [
    settings.game.autoSync.syncOnCreate ? 'create' : undefined,
    settings.game.autoSync.playStatusEnabled ? 'status' : undefined,
    settings.game.autoSync.scoreEnabled ? 'score' : undefined
  ].filter((item): item is AutoSyncItem => !!item)
}

function createFullSyncItems(settings: BangumiSettingsV1): readonly FullSyncItem[] {
  return [
    settings.game.autoSync.playStatusEnabled ? 'status' : undefined,
    settings.game.autoSync.scoreEnabled ? 'score' : undefined
  ].filter((item): item is FullSyncItem => !!item)
}
