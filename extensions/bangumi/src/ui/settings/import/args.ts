import type { SerializableRecord } from '@kisaki/extension-sdk'
import { SETTINGS_NODE_IDS } from '../ids'
import { readString } from '../shared/values'
import {
  createIndexTargetCollectionArg,
  createImportDataItemArgs,
  createImportTargetCollectionArg,
  readImportCollectionTypes,
  readImportPatchExisting,
  readImportScope
} from './options'

export function createMyCollectionsImportArgs(
  values: SerializableRecord,
  fallbackProfileId: string,
  dryRun: boolean
): SerializableRecord {
  return {
    scope: readImportScope(values),
    dryRun,
    profileId: readString(values, SETTINGS_NODE_IDS.importProfileId, fallbackProfileId),
    collectionTypes: readImportCollectionTypes(values),
    fields: createImportDataItemArgs(values),
    patchExisting: readImportPatchExisting(values),
    targetCollection: createImportTargetCollectionArg(values),
    concurrency: 4
  }
}

export function createIndexImportArgs(
  values: SerializableRecord,
  fallbackProfileId: string,
  dryRun: boolean
): SerializableRecord {
  return {
    scope: readImportScope(values),
    dryRun,
    profileId: readString(values, SETTINGS_NODE_IDS.importProfileId, fallbackProfileId),
    indexInput: readString(values, SETTINGS_NODE_IDS.importIndexInput, ''),
    patchExisting: readImportPatchExisting(values),
    targetCollection: createIndexTargetCollectionArg(values),
    concurrency: 4
  }
}
