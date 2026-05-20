import type {
  LibraryCollection,
  ScraperProfileSummary,
  SerializableRecord,
  SettingsPanelDialogNodeEvents,
  SettingsPanelField,
  SettingsPanelNodeFactory
} from '@kisaki/extension-sdk'
import {
  BANGUMI_COLLECTION_TYPE_OPTIONS,
  INDEX_TARGET_COLLECTION_MODE_OPTIONS,
  SETTINGS_NODE_IDS
} from '../ids'
import { createProfileOptions } from '../shared/profiles'
import { pickKnownValues, readBoolean, readString, readStringArray } from '../shared/values'
import type { BangumiSettingsPopovers } from '../shared/types'

export type ImportDataItem = 'status' | 'score' | 'tags'
export type IndexTargetCollectionMode = 'none' | 'existing' | 'byIndexTitle'

const IMPORT_DATA_ITEMS = [
  'status',
  'score',
  'tags'
] as const satisfies readonly ImportDataItem[]
const INDEX_TARGET_COLLECTION_MODES = [
  'none',
  'existing',
  'byIndexTitle'
] as const satisfies readonly IndexTargetCollectionMode[]

export function createDialogImportProfileField<
  TParams extends SerializableRecord = SerializableRecord
>({
  settings,
  values,
  profiles
}: {
  settings: SettingsPanelNodeFactory<
    SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>
  >
  values: SerializableRecord
  profiles: readonly ScraperProfileSummary[]
}): SettingsPanelField<SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>> {
  const profileOptions = createProfileOptions(profiles)
  const fallbackProfileId = profiles[0]?.id ?? ''

  return {
    id: 'import-profile',
    label: '刮削配置',
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

export function createDialogImportTargetCollectionField<
  TParams extends SerializableRecord = SerializableRecord
>({
  settings,
  values,
  collections
}: {
  settings: SettingsPanelNodeFactory<
    SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>
  >
  values: SerializableRecord
  collections: readonly LibraryCollection[]
}): SettingsPanelField<SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>> {
  return {
    id: 'import-target-collection',
    label: '目标合集',
    description: '将匹配到的游戏加入该合集',
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

export function createDialogIndexTargetCollectionFields<
  TParams extends SerializableRecord = SerializableRecord
>({
  settings,
  values,
  collections
}: {
  settings: SettingsPanelNodeFactory<
    SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>
  >
  values: SerializableRecord
  collections: readonly LibraryCollection[]
}): readonly SettingsPanelField<SettingsPanelDialogNodeEvents<TParams, BangumiSettingsPopovers>>[] {
  const mode = readIndexTargetCollectionMode(values)

  return [
    {
      id: 'index-target-collection-strategy',
      label: '目标合集策略',
      description: '选择目录导入后如何加入合集',
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
      hidden: mode !== 'existing',
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

export function readImportDataItems(values: SerializableRecord): readonly ImportDataItem[] {
  return pickKnownValues(
    readStringArray(values, SETTINGS_NODE_IDS.importDataItems, []),
    IMPORT_DATA_ITEMS
  )
}

export function createImportDataItemArgs(values: SerializableRecord): SerializableRecord {
  const fields = readImportDataItems(values)
  return {
    status: fields.includes('status'),
    score: fields.includes('score'),
    tags: fields.includes('tags')
  }
}

export function readImportPatchExisting(values: SerializableRecord): boolean {
  return readBoolean(values, SETTINGS_NODE_IDS.importPatchExisting, false)
}

export function readImportUseTargetCollection(values: SerializableRecord): boolean {
  return readBoolean(
    values,
    SETTINGS_NODE_IDS.importUseTargetCollection,
    !!readImportTargetCollectionId(values)
  )
}

export function readImportTargetCollectionId(values: SerializableRecord): string {
  return readString(values, SETTINGS_NODE_IDS.importTargetCollectionId, '')
}

export function createImportTargetCollectionArg(values: SerializableRecord): SerializableRecord {
  if (!readImportUseTargetCollection(values)) {
    return { kind: 'none' }
  }

  const collectionId = readImportTargetCollectionId(values)
  return collectionId ? { kind: 'existing', collectionId } : { kind: 'none' }
}

export function readIndexTargetCollectionMode(
  values: SerializableRecord
): IndexTargetCollectionMode {
  return (
    pickKnownValues(
      [readString(values, SETTINGS_NODE_IDS.importTargetCollectionMode, 'none')],
      INDEX_TARGET_COLLECTION_MODES
    )[0] ?? 'none'
  )
}

export function createIndexTargetCollectionArg(values: SerializableRecord): SerializableRecord {
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

export function readImportCollectionTypes(values: SerializableRecord): readonly string[] {
  return readStringArray(
    values,
    SETTINGS_NODE_IDS.importCollectionTypes,
    BANGUMI_COLLECTION_TYPE_OPTIONS.map((option) => option.value)
  )
}

function createCollectionOptions(collections: readonly LibraryCollection[]) {
  return collections.map((collection) => ({
    value: collection.id,
    label: collection.name,
    ...(collection.description ? { description: collection.description } : {})
  }))
}
