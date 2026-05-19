import type { ScraperProfileSummary, SerializableRecord } from '@kisaki/extension-sdk'
import {
  BANGUMI_COLLECTION_TYPE_OPTIONS,
  IMPORT_WRITE_FIELD_OPTIONS,
  NODE_IDS
} from '../common/constants'
import { createProfileOptions } from '../common/profiles'
import { pickKnownValues, readString, readStringArray } from '../common/values'
import type { BangumiSettingsDialogFactory, BangumiSettingsDialogField } from '../common/types'

export type ImportWriteField = 'status' | 'score' | 'tags'

const IMPORT_WRITE_FIELDS = [
  'status',
  'score',
  'tags'
] as const satisfies readonly ImportWriteField[]

export function createDialogImportProfileField({
  settings,
  values,
  profiles
}: {
  settings: BangumiSettingsDialogFactory
  values: SerializableRecord
  profiles: readonly ScraperProfileSummary[]
}): BangumiSettingsDialogField {
  const profileOptions = createProfileOptions(profiles)
  const fallbackProfileId = profiles[0]?.id ?? ''

  return {
    id: 'import-profile',
    label: 'Scraper Profile',
    content: [
      settings.select({
        id: NODE_IDS.importProfileId,
        initialValue: readString(values, NODE_IDS.importProfileId, fallbackProfileId),
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

export function createImportWriteFieldsField(
  settings: BangumiSettingsDialogFactory,
  values: SerializableRecord
): BangumiSettingsDialogField {
  return {
    id: 'import-write-fields',
    label: '写入项',
    description: '只对本次新建的游戏写入这些用户态数据',
    content: [
      settings.multiSelect({
        id: NODE_IDS.importWriteFields,
        initialValue: readImportWriteFields(values),
        options: IMPORT_WRITE_FIELD_OPTIONS,
        onCommit(event) {
          return event.refresh('dialog')
        }
      })
    ]
  }
}

export function readImportWriteFields(values: SerializableRecord): readonly ImportWriteField[] {
  return pickKnownValues(
    readStringArray(values, NODE_IDS.importWriteFields, []),
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
    NODE_IDS.importCollectionTypes,
    BANGUMI_COLLECTION_TYPE_OPTIONS.map((option) => option.value)
  )
}
