import type { SerializableRecord } from '@kisaki/extension-sdk'
import type { BangumiCollectionType } from '../config/schema'
import { BangumiExtensionError } from '../shared/errors'

export type BangumiImportTargetCollection =
  | { kind: 'none' }
  | { kind: 'existing'; collectionId: string }
  | { kind: 'byIndexTitle' }

export interface BangumiImportWriteFields {
  status: boolean
  score: boolean
  tags: boolean
}

export interface BangumiAuthRefreshArgs {
  dryRun: false
  forceRefresh: boolean
  verifyAccount: boolean
}

export interface BangumiChangedGamesSyncArgs {
  dryRun: boolean
  limit: number
}

export interface BangumiFullSyncArgs {
  dryRun: boolean
  updateExisting: boolean
  batchSize: number
  playStatusEnabled?: boolean
  scoreEnabled?: boolean
  clearRemoteScoreWhenEmpty?: boolean
}

export interface BangumiImportMyCollectionsArgs {
  dryRun: boolean
  profileId: string
  collectionTypes: readonly BangumiCollectionType[]
  fields: BangumiImportWriteFields
  patchExisting: boolean
  targetCollection: BangumiImportTargetCollection
  concurrency: number
}

export interface BangumiImportIndexArgs {
  dryRun: boolean
  profileId: string
  indexInput: string
  indexId: number
  patchExisting: boolean
  targetCollection: BangumiImportTargetCollection
  concurrency: number
}

const BANGUMI_COLLECTION_TYPES = [1, 2, 3, 4, 5] as const satisfies readonly BangumiCollectionType[]

export function normalizeAuthRefreshArgs(args: SerializableRecord): BangumiAuthRefreshArgs {
  return {
    dryRun: false,
    forceRefresh: readBoolean(args.forceRefresh, true),
    verifyAccount: readBoolean(args.verifyAccount, true)
  }
}

export function normalizeChangedGamesSyncArgs(
  args: SerializableRecord
): BangumiChangedGamesSyncArgs {
  return {
    dryRun: readBoolean(args.dryRun, false),
    limit: readInteger(args.limit, 500, { min: 1, max: 10_000 })
  }
}

export function normalizeFullSyncArgs(args: SerializableRecord): BangumiFullSyncArgs {
  return {
    dryRun: readBoolean(args.dryRun, true),
    updateExisting: readBoolean(args.updateExisting, true),
    batchSize: readInteger(args.batchSize, 100, { min: 1, max: 500 }),
    ...readOptionalBooleanProp(args.playStatusEnabled, 'playStatusEnabled'),
    ...readOptionalBooleanProp(args.scoreEnabled, 'scoreEnabled'),
    ...readOptionalBooleanProp(args.clearRemoteScoreWhenEmpty, 'clearRemoteScoreWhenEmpty')
  }
}

export function normalizeImportMyCollectionsArgs(
  args: SerializableRecord
): BangumiImportMyCollectionsArgs {
  return {
    dryRun: readBoolean(args.dryRun, true),
    profileId: readRequiredString(args.profileId, '请选择用于创建游戏的 scraper profile。'),
    collectionTypes: normalizeCollectionTypes(args.collectionTypes),
    fields: normalizeImportWriteFields(args.fields),
    patchExisting: readBoolean(args.patchExisting, false),
    targetCollection: normalizeTargetCollection(args.targetCollection, false),
    concurrency: readInteger(args.concurrency, 4, { min: 1, max: 8 })
  }
}

export function normalizeImportIndexArgs(args: SerializableRecord): BangumiImportIndexArgs {
  const indexInput = readRequiredString(args.indexInput, '请输入 Bangumi 目录 ID 或 URL。')

  return {
    dryRun: readBoolean(args.dryRun, true),
    profileId: readRequiredString(args.profileId, '请选择用于创建游戏的 scraper profile。'),
    indexInput,
    indexId: parseBangumiIndexId(indexInput),
    patchExisting: readBoolean(args.patchExisting, false),
    targetCollection: normalizeTargetCollection(args.targetCollection, true),
    concurrency: readInteger(args.concurrency, 4, { min: 1, max: 8 })
  }
}

export function parseBangumiIndexId(input: string): number {
  const trimmed = input.trim()
  const direct = Number.parseInt(trimmed, 10)

  if (/^\d+$/.test(trimmed) && Number.isFinite(direct) && direct > 0) {
    return direct
  }

  try {
    const url = new URL(trimmed)
    if (!['bgm.tv', 'bangumi.tv'].includes(url.hostname.toLowerCase())) {
      throw new Error('Unsupported host.')
    }

    const match = url.pathname.match(/^\/index\/(\d+)\/?$/)
    const value = match ? Number.parseInt(match[1]!, 10) : 0
    if (Number.isFinite(value) && value > 0) {
      return value
    }
  } catch {
    // Fall through to the user-facing validation error below.
  }

  throw new BangumiExtensionError(
    'bangumi_validation',
    'Bangumi 目录必须是数字 ID，或 https://bgm.tv/index/<id> 形式的 URL。'
  )
}

function normalizeCollectionTypes(value: unknown): readonly BangumiCollectionType[] {
  const input = Array.isArray(value) ? value : []
  const collectionTypes = input
    .map((item) => (typeof item === 'string' ? Number.parseInt(item, 10) : item))
    .filter((item): item is BangumiCollectionType =>
      BANGUMI_COLLECTION_TYPES.includes(item as BangumiCollectionType)
    )
  return collectionTypes.length > 0 ? [...new Set(collectionTypes)] : [...BANGUMI_COLLECTION_TYPES]
}

function normalizeImportWriteFields(value: unknown): BangumiImportWriteFields {
  const record = asRecord(value)
  return {
    status: readBoolean(record?.status, false),
    score: readBoolean(record?.score, false),
    tags: readBoolean(record?.tags, false)
  }
}

function normalizeTargetCollection(
  value: unknown,
  allowByIndexTitle: boolean
): BangumiImportTargetCollection {
  const record = asRecord(value)
  const kind = typeof record?.kind === 'string' ? record.kind : 'none'

  if (kind === 'existing') {
    return {
      kind,
      collectionId: readRequiredString(record?.collectionId, '请选择目标合集。')
    }
  }

  if (kind === 'byIndexTitle' && allowByIndexTitle) {
    return { kind }
  }

  return { kind: 'none' }
}

function readOptionalBooleanProp(
  value: unknown,
  key: 'playStatusEnabled' | 'scoreEnabled' | 'clearRemoteScoreWhenEmpty'
): Partial<BangumiFullSyncArgs> {
  return typeof value === 'boolean' ? { [key]: value } : {}
}

function readRequiredString(value: unknown, message: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) {
    throw new BangumiExtensionError('bangumi_validation', message)
  }
  return text
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readInteger(
  value: unknown,
  fallback: number,
  limits: { min: number; max: number }
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(limits.max, Math.max(limits.min, Math.trunc(value)))
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}
