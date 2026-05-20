import type { ExtensionStorage } from '@kisaki/extension-sdk'
import { BANGUMI_STORAGE_KEYS } from '../shared/ids'

export interface SyncQueueItem {
  gameId: string
  queuedAt: number
  reason: 'created' | 'updated' | 'manual'
}

interface BangumiSyncQueueV1 {
  version: 1
  games: Record<string, SyncQueueItem>
}

const MAX_SYNC_QUEUE_ITEMS = 5000

export class SyncQueueStore {
  constructor(private readonly storage: ExtensionStorage) {}

  async enqueue(gameId: string, reason: SyncQueueItem['reason']): Promise<void> {
    const queue = await this.read()
    queue.games[gameId] = {
      gameId,
      queuedAt: Date.now(),
      reason
    }
    await this.write(pruneQueue(queue))
  }

  async list(limit: number): Promise<readonly SyncQueueItem[]> {
    const queue = await this.read()
    return Object.values(queue.games)
      .sort((left, right) => left.queuedAt - right.queuedAt)
      .slice(0, normalizeLimit(limit))
  }

  async remove(gameIds: readonly string[]): Promise<void> {
    if (gameIds.length === 0) {
      return
    }

    const queue = await this.read()
    for (const gameId of gameIds) {
      delete queue.games[gameId]
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
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.games)) {
    return createEmptyQueue()
  }

  const games: Record<string, SyncQueueItem> = {}
  for (const [gameId, item] of Object.entries(value.games)) {
    if (!isRecord(item)) {
      continue
    }

    const normalizedGameId = readNonEmptyString(item.gameId) || gameId.trim()
    if (!normalizedGameId) {
      continue
    }

    games[normalizedGameId] = {
      gameId: normalizedGameId,
      queuedAt: readTimestamp(item.queuedAt),
      reason: normalizeReason(item.reason)
    }
  }

  return pruneQueue({ version: 1, games })
}

function createEmptyQueue(): BangumiSyncQueueV1 {
  return {
    version: 1,
    games: {}
  }
}

function pruneQueue(queue: BangumiSyncQueueV1): BangumiSyncQueueV1 {
  const entries = Object.entries(queue.games).sort(
    (left, right) => right[1].queuedAt - left[1].queuedAt
  )

  return {
    version: 1,
    games: Object.fromEntries(entries.slice(0, MAX_SYNC_QUEUE_ITEMS))
  }
}

function normalizeLimit(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.min(10_000, Math.trunc(value)) : 500
}

function normalizeReason(value: unknown): SyncQueueItem['reason'] {
  return value === 'created' || value === 'updated' || value === 'manual' ? value : 'updated'
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
