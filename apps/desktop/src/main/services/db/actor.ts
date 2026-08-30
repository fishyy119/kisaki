/**
 * Database write attribution.
 *
 * Every database write happens synchronously on the main process's single
 * connection, so an async-local actor context around the write call reaches
 * the change-capture triggers deterministically: the trigger's registered SQL
 * function executes inside the writing statement's call stack and reads the
 * context. Change rows therefore carry per-row attribution regardless of how
 * the feed later batches them.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

/** Attribution recorded for writes without an explicit actor context. */
export const APP_DB_ACTOR = 'app'

const storage = new AsyncLocalStorage<string>()

/** Actor id for writes an extension causes through its capability calls. */
export function extensionDbActor(extensionId: string): string {
  return `extension:${extensionId}`
}

/** Runs `fn` with all database writes it causes attributed to `actor`. */
export function runAsDbActor<T>(actor: string, fn: () => T): T {
  return storage.run(actor, fn)
}

export function getCurrentDbActor(): string {
  return storage.getStore() ?? APP_DB_ACTOR
}
