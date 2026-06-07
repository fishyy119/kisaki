import type {
  ScraperProfileSummary,
  JsonObject,
  SettingsPanelDialogNodeEvents,
  SettingsPanelField,
  SettingsPanelNodeFactory
} from '@kisaki3/extension-sdk'
import { SETTINGS_NODE_IDS } from '../ids'
import type { MediaRegistry } from '../../../media/registry'
import type { BangumiMediaScope } from '../../../media/scopes'
import type { LocalCollectionSummary } from '../../../media/types'
import { MEDIA_SCOPE_OPTIONS } from '../shared/options'
import { createProfileOptions } from '../shared/profiles'
import { pickKnownValues, readBoolean, readString, readStringArray } from '../shared/values'
import type { BangumiSettingsPopovers } from '../shared/types'

export type ImportDataItem = 'status' | 'score' | 'tags'
export type IndexTargetCollectionMode = 'none' | 'existing' | 'byIndexTitle'

export const IMPORT_DATA_ITEM_OPTIONS = [
  { value: 'status', label: '游玩状态' },
  { value: 'score', label: '评分' },
  { value: 'tags', label: '标签' }
] as const

export const INDEX_TARGET_COLLECTION_MODE_OPTIONS = [
  { value: 'none', label: '不加入合集', description: '只导入缺失游戏' },
  { value: 'existing', label: '选择现有合集', description: '将导入的游戏加入指定合集' },
  {
    value: 'byIndexTitle',
    label: '按目录名创建合集',
    description: '按 Bangumi 目录名创建或复用合集'
  }
] as const

const IMPORT_DATA_ITEMS = ['status', 'score', 'tags'] as const satisfies readonly ImportDataItem[]
const BANGUMI_COLLECTION_TYPE_VALUES = ['1', '2', '3', '4', '5'] as const
const LOCAL_IMPORT_SCOPES = ['game'] as const satisfies readonly BangumiMediaScope[]
const INDEX_TARGET_COLLECTION_MODES = [
  'none',
  'existing',
  'byIndexTitle'
] as const satisfies readonly IndexTargetCollectionMode[]

export function createDialogImportProfileField<TParams extends JsonObject = JsonObject>({
  settings,
  values,
  profiles
}: {
  settings: SettingsPanelNodeFactory<
    SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>
  >
  values: JsonObject
  profiles: readonly ScraperProfileSummary[]
}): SettingsPanelField<SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>> {
  const scope = readImportScope(values)
  const profileOptions = createProfileOptions(profiles)
  const fallbackProfileId = profiles[0]?.id ?? ''

  return {
    id: 'import-profile',
    label: '刮削配置',
    hidden: scope !== 'game',
    content: [
      settings.select({
        id: SETTINGS_NODE_IDS.importProfileId,
        initialValue: readString(values, SETTINGS_NODE_IDS.importProfileId, fallbackProfileId),
        placeholder: '选择游戏刮削配置',
        options: profileOptions,
        disabled: profileOptions.length === 0,
        onChange(event) {
          return event.refresh('dialog')
        }
      })
    ]
  }
}

export function createDialogImportTargetCollectionField<TParams extends JsonObject = JsonObject>({
  settings,
  values,
  collections
}: {
  settings: SettingsPanelNodeFactory<
    SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>
  >
  values: JsonObject
  collections: readonly LocalCollectionSummary[]
}): SettingsPanelField<SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>> {
  const scope = readImportScope(values)
  return {
    id: 'import-target-collection',
    label: '目标合集',
    description: '将匹配到的游戏加入该合集',
    hidden: scope !== 'game',
    orientation: 'horizontal',
    contentLayout: 'inline',
    content: [
      settings.switch({
        id: SETTINGS_NODE_IDS.importUseTargetCollection,
        initialValue: readImportUseTargetCollection(values),
        disabled: collections.length === 0,
        onChange(event) {
          return event.refresh('dialog')
        }
      }),
      settings.select({
        id: SETTINGS_NODE_IDS.importTargetCollectionId,
        initialValue: readImportTargetCollectionId(values),
        placeholder: collections.length > 0 ? '选择合集' : '没有可用合集',
        options: createCollectionOptions(collections),
        disabled: !readImportUseTargetCollection(values) || collections.length === 0,
        onChange(event) {
          return event.refresh('dialog')
        }
      })
    ]
  }
}

export function createDialogIndexTargetCollectionFields<TParams extends JsonObject = JsonObject>({
  settings,
  values,
  collections
}: {
  settings: SettingsPanelNodeFactory<
    SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>
  >
  values: JsonObject
  collections: readonly LocalCollectionSummary[]
}): readonly SettingsPanelField<SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>>[] {
  const mode = readIndexTargetCollectionMode(values)
  const scope = readImportScope(values)

  return [
    {
      id: 'index-target-collection-strategy',
      label: '目标合集策略',
      description: '选择目录导入后如何加入合集',
      hidden: scope !== 'game',
      orientation: 'vertical',
      content: [
        settings.radioGroup({
          id: SETTINGS_NODE_IDS.importTargetCollectionMode,
          initialValue: mode,
          options: INDEX_TARGET_COLLECTION_MODE_OPTIONS,
          onChange(event) {
            return event.refresh('dialog')
          }
        })
      ]
    },
    {
      id: 'index-target-collection-id',
      label: '选择合集',
      hidden: scope !== 'game' || mode !== 'existing',
      content: [
        settings.select({
          id: SETTINGS_NODE_IDS.importTargetCollectionId,
          initialValue: readImportTargetCollectionId(values),
          placeholder: collections.length > 0 ? '选择合集' : '没有可用合集',
          options: createCollectionOptions(collections),
          disabled: collections.length === 0,
          onChange(event) {
            return event.refresh('dialog')
          }
        })
      ]
    }
  ]
}

export function createDialogImportScopeField<TParams extends JsonObject = JsonObject>({
  settings,
  values,
  mediaRegistry
}: {
  settings: SettingsPanelNodeFactory<
    SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>
  >
  values: JsonObject
  mediaRegistry: MediaRegistry
}): SettingsPanelField<SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>> {
  return {
    id: 'import-scope',
    label: '媒体类型',
    description: '当前仅支持游戏本地导入',
    orientation: 'horizontal',
    contentLayout: 'inline',
    content: [
      settings.radioGroup({
        id: SETTINGS_NODE_IDS.importScope,
        initialValue: readImportScope(values),
        orientation: 'horizontal',
        options: createImportScopeOptions(mediaRegistry),
        onChange(event) {
          return event.refresh('dialog')
        }
      })
    ]
  }
}

export function readImportScope(values: JsonObject): BangumiMediaScope {
  const value = readString(values, SETTINGS_NODE_IDS.importScope, 'game')
  return value === LOCAL_IMPORT_SCOPES[0] ? value : 'game'
}

export function readImportDataItems(values: JsonObject): readonly ImportDataItem[] {
  if (readImportScope(values) !== 'game') {
    return []
  }

  return pickKnownValues(
    readStringArray(values, SETTINGS_NODE_IDS.importDataItems, []),
    IMPORT_DATA_ITEMS
  )
}

export function createImportDataItemArgs(values: JsonObject): JsonObject {
  const fields = readImportDataItems(values)
  return {
    status: fields.includes('status'),
    score: fields.includes('score'),
    tags: fields.includes('tags')
  }
}

export function readImportPatchExisting(values: JsonObject): boolean {
  return readImportScope(values) === 'game'
    ? readBoolean(values, SETTINGS_NODE_IDS.importPatchExisting, false)
    : false
}

export function readImportUseTargetCollection(values: JsonObject): boolean {
  if (readImportScope(values) !== 'game') {
    return false
  }

  return readBoolean(
    values,
    SETTINGS_NODE_IDS.importUseTargetCollection,
    !!readImportTargetCollectionId(values)
  )
}

export function readImportTargetCollectionId(values: JsonObject): string {
  return readString(values, SETTINGS_NODE_IDS.importTargetCollectionId, '')
}

export function createImportTargetCollectionArg(values: JsonObject): JsonObject {
  if (!readImportUseTargetCollection(values)) {
    return { kind: 'none' }
  }

  const collectionId = readImportTargetCollectionId(values)
  return collectionId ? { kind: 'existing', collectionId } : { kind: 'none' }
}

export function readIndexTargetCollectionMode(values: JsonObject): IndexTargetCollectionMode {
  if (readImportScope(values) !== 'game') {
    return 'none'
  }

  return (
    pickKnownValues(
      [readString(values, SETTINGS_NODE_IDS.importTargetCollectionMode, 'none')],
      INDEX_TARGET_COLLECTION_MODES
    )[0] ?? 'none'
  )
}

export function createIndexTargetCollectionArg(values: JsonObject): JsonObject {
  const mode = readIndexTargetCollectionMode(values)

  if (mode === 'byIndexTitle') {
    return { kind: 'byIndexTitle' }
  }

  if (mode === 'existing') {
    const collectionId = readImportTargetCollectionId(values)
    return collectionId ? { kind: 'existing', collectionId } : { kind: 'none' }
  }

  return { kind: 'none' }
}

export function readImportCollectionTypes(values: JsonObject): readonly string[] {
  return readStringArray(
    values,
    SETTINGS_NODE_IDS.importCollectionTypes,
    BANGUMI_COLLECTION_TYPE_VALUES
  )
}

function createCollectionOptions(collections: readonly LocalCollectionSummary[]) {
  return collections.map((collection) => ({
    value: collection.id,
    label: collection.name,
    ...(collection.description ? { description: collection.description } : {})
  }))
}

function createImportScopeOptions(mediaRegistry: MediaRegistry) {
  return MEDIA_SCOPE_OPTIONS.map((option) => ({
    ...option,
    disabled: !mediaRegistry.require(option.value).localAdapter?.supportsImportWrite
  }))
}
