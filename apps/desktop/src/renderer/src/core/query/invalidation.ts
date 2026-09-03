/**
 * Invalidation sources.
 *
 * One subscription per IPC channel, fanned out to every query that declared
 * it; `db:changed` pushes arrive pre-aggregated into a batch. Subscriptions
 * are created on first use, so nothing is wired at module import.
 */

import { aggregateDbChanges, type DbChangeBatch } from '@shared/db/changes'
import type { TableName } from '@shared/db/table-names'
import { ipcManager } from '@renderer/core/ipc'
import type { IpcEventChannel, QueryInvalidation } from './types'

const NO_TABLES: ReadonlySet<TableName> = new Set()

/** The tables a declaration resolves to for the given context. */
export function resolveTables<TContext>(
  invalidation: QueryInvalidation<TContext> | undefined,
  context: TContext
): ReadonlySet<TableName> {
  const tables = invalidation?.tables
  if (!tables) return NO_TABLES
  return new Set(typeof tables === 'function' ? tables(context) : tables)
}

type DbChangesListener = (batch: DbChangeBatch) => void

const dbChangesListeners = new Set<DbChangesListener>()
let dbChangesWired = false

export function subscribeDbChanges(listener: DbChangesListener): () => void {
  if (!dbChangesWired) {
    dbChangesWired = true
    ipcManager.on('db:changed', (_e, changes) => {
      if (changes.length === 0) return
      const batch = aggregateDbChanges(changes)
      for (const subscriber of [...dbChangesListeners]) subscriber(batch)
    })
  }
  dbChangesListeners.add(listener)
  return () => {
    dbChangesListeners.delete(listener)
  }
}

const ipcListeners = new Map<IpcEventChannel, Set<() => void>>()

export function subscribeIpc(channel: IpcEventChannel, listener: () => void): () => void {
  let listeners = ipcListeners.get(channel)
  if (!listeners) {
    const subscribers = new Set<() => void>()
    listeners = subscribers
    ipcListeners.set(channel, subscribers)
    ipcManager.on(channel, () => {
      for (const subscriber of [...subscribers]) subscriber()
    })
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
