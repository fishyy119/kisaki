import type { SerializableRecord } from '@kisaki/extension-sdk'
import { SETTINGS_NODE_IDS } from '../ids'
import { readString } from '../shared/values'
import { createImportWriteFieldArgs, readImportCollectionTypes } from './options'

export function createMyCollectionsImportArgs(
  values: SerializableRecord,
  fallbackProfileId: string,
  dryRun: boolean
): SerializableRecord {
  return {
    dryRun,
    profileId: readString(values, SETTINGS_NODE_IDS.importProfileId, fallbackProfileId),
    collectionTypes: readImportCollectionTypes(values),
    fields: createImportWriteFieldArgs(values),
    targetCollection: {
      kind: 'none'
    },
    concurrency: 4
  }
}

export function createIndexImportArgs(
  values: SerializableRecord,
  fallbackProfileId: string,
  dryRun: boolean
): SerializableRecord {
  return {
    dryRun,
    profileId: readString(values, SETTINGS_NODE_IDS.importProfileId, fallbackProfileId),
    indexInput: readString(values, SETTINGS_NODE_IDS.importIndexInput, ''),
    targetCollection: {
      kind: 'none'
    },
    concurrency: 4
  }
}
