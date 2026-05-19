import type {
  ScraperProfileSummary,
  SerializableRecord,
  SettingsPanelDialogNodeEvents,
  SettingsPanelField,
  SettingsPanelNodeFactory
} from '@kisaki/extension-sdk'
import { BANGUMI_COLLECTION_TYPE_OPTIONS, SETTINGS_NODE_IDS } from '../ids'
import { createProfileOptions } from '../shared/profiles'
import { pickKnownValues, readString, readStringArray } from '../shared/values'
import type { BangumiSettingsPopovers } from '../shared/types'

export type ImportWriteField = 'status' | 'score' | 'tags'

const IMPORT_WRITE_FIELDS = [
  'status',
  'score',
  'tags'
] as const satisfies readonly ImportWriteField[]

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
    label: 'Scraper Profile',
    content: [
      settings.select({
        id: SETTINGS_NODE_IDS.importProfileId,
        initialValue: readString(values, SETTINGS_NODE_IDS.importProfileId, fallbackProfileId),
        placeholder: '选择游戏 scraper profile',
        options: profileOptions,
        disabled: profileOptions.length === 0,
        onCommit(event) {
          return event.refresh('dialog')
        }
      })
    ]
  }
}

export function readImportWriteFields(values: SerializableRecord): readonly ImportWriteField[] {
  return pickKnownValues(
    readStringArray(values, SETTINGS_NODE_IDS.importWriteFields, []),
    IMPORT_WRITE_FIELDS
  )
}

export function createImportWriteFieldArgs(values: SerializableRecord): SerializableRecord {
  const fields = readImportWriteFields(values)
  return {
    status: fields.includes('status'),
    score: fields.includes('score'),
    tags: fields.includes('tags')
  }
}

export function readImportCollectionTypes(values: SerializableRecord): readonly string[] {
  return readStringArray(
    values,
    SETTINGS_NODE_IDS.importCollectionTypes,
    BANGUMI_COLLECTION_TYPE_OPTIONS.map((option) => option.value)
  )
}
