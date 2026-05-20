import type { ExtensionStorage } from '@kisaki/extension-sdk'
import type { BangumiMediaScope } from '../media/scopes'
import { BANGUMI_STORAGE_KEYS } from '../shared/ids'

export interface SyncQueueItem {
  scope: BangumiMediaScope
  localId: string
  queuedAt: number
  reason: 'created' | 'updated' | 'manual'
}

interface BangumiSyncQueueV1 {
  version: 1
  items: Record<string, SyncQueueItem>
}

const MAX_SYNC_QUEUE_ITEMS = 5000

export class SyncQueueStore {
  constructor(private readonly storage: ExtensionStorage) {}

  async enqueue(
    scope: BangumiMediaScope,
    localId: string,
    reason: SyncQueueItem['reason']
  ): Promise<void> {
    const queue = await this.read()
    queue.items[createQueueKey(scope, localId)] = {
      scope,
      localId,
      queuedAt: Date.now(),
      reason
    }
    await this.write(pruneQueue(queue))
  }

  async list(limit: number, scope?: BangumiMediaScope): Promise<readonly SyncQueueItem[]> {
    const queue = await this.read()
    return Object.values(queue.items)
      .filter((item) => !scope || item.scope === scope)
      .sort((left, right) => left.queuedAt - right.queuedAt)
      .slice(0, normalizeLimit(limit))
  }

  async remove(items: readonly Pick<SyncQueueItem, 'scope' | 'localId'>[]): Promise<void> {
    if (items.length === 0) {
      return
    }

    const queue = await this.read()
    for (const item of items) {
      delete queue.items[createQueueKey(item.scope, item.localId)]
    }
    await this.write(queue)
  }

  async clear(): Promise<void> {
    await this.storage.delete(BANGUMI_STORAGE_KEYS.syncQueue)
  }

  private async read(): Promise<BangumiSyncQueueV1> {
    const raw = await this.storage.get<unknown>(BANGUMI_STORAGE_KEYS.syncQueue, null)
    const queue = normalizeQueue(raw)

    if (!queueEqual(raw, queue)) {
      await this.write(queue)
    }

    return queue
  }

  private async write(queue: BangumiSyncQueueV1): Promise<void> {
    await this.storage.set(BANGUMI_STORAGE_KEYS.syncQueue, queue)
  }
}

function normalizeQueue(value: unknown): BangumiSyncQueueV1 {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.items)) {
    return createEmptyQueue()
  }

  const items: Record<string, SyncQueueItem> = {}
  for (const [key, item] of Object.entries(value.items)) {
    if (!isRecord(item)) {
      continue
    }

    const scope = normalizeScope(item.scope)
    const localId = readNonEmptyString(item.localId) || readLocalIdFromKey(key)
    if (!scope || !localId) {
      continue
    }

    items[createQueueKey(scope, localId)] = {
      scope,
      localId,
      queuedAt: readTimestamp(item.queuedAt),
      reason: normalizeReason(item.reason)
    }
  }

  return pruneQueue({ version: 1, items })
}

function createEmptyQueue(): BangumiSyncQueueV1 {
  return {
    version: 1,
    items: {}
  }
}

function pruneQueue(queue: BangumiSyncQueueV1): BangumiSyncQueueV1 {
  const entries = Object.entries(queue.items).sort(
    (left, right) => right[1].queuedAt - left[1].queuedAt
  )

  return {
    version: 1,
    items: Object.fromEntries(entries.slice(0, MAX_SYNC_QUEUE_ITEMS))
  }
}

function normalizeLimit(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.min(10_000, Math.trunc(value)) : 500
}

function normalizeReason(value: unknown): SyncQueueItem['reason'] {
  return value === 'created' || value === 'updated' || value === 'manual' ? value : 'updated'
}

function normalizeScope(value: unknown): BangumiMediaScope | undefined {
  return value === 'book' || value === 'game' || value === 'anime' || value === 'music'
    ? value
    : undefined
}

function createQueueKey(scope: BangumiMediaScope, localId: string): string {
  return `${scope}:${localId}`
}

function readLocalIdFromKey(key: string): string {
  const index = key.indexOf(':')
  return index >= 0 ? key.slice(index + 1).trim() : key.trim()
}

function readNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : Date.now()
}

function queueEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
