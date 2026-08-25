/**
 * Data platform service.
 *
 * Owns three layers that a synchronous SQLite connection cannot separate:
 * - infrastructure: connection, migrations, change capture, SQL execution;
 * - library-graph transaction core (`curation`, `helper`), whose operations must
 *   see every entity table inside one transaction;
 * - row-attached bytes (`attachment`), whose lifetime follows its owning row.
 *
 * Workflows that only need main-process capabilities belong to the service that
 * owns them, not here: AttachmentService owns cropping, ingest owns imports.
 */

import Database from 'better-sqlite3'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { app } from 'electron'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createLogger } from '@main/log'
import { eq } from 'drizzle-orm'
import * as schema from '@shared/db/schema'
import { settings, tags } from '@shared/db/schema'
import { normalizeKeyText } from '@shared/identity'
import type { INonDomainService, ServiceInitContainer } from '@main/container'
import { AttachmentStore, ThumbnailStore, registerAttachmentProtocol } from './attachment'
import { EntityDeleteCoordinator, EntityMergeCoordinator } from './curation'
import { EntityFinderHelper } from './helper'
import { FtsStore } from './fts'
import { TriggerStore, dropAllTriggers } from './trigger'
import { DbChangeFeed } from './feed'
import { createDbHooks } from './hooks'
import { registerDbIpc } from './ipc'
import { SettingsStore } from './settings'
import { SqlExecutor } from './sql'

const log = createLogger('Db')

/** Entity curation workflows: merging duplicates and weeding rows out. */
export interface DbCuration {
  merge: EntityMergeCoordinator
  delete: EntityDeleteCoordinator
}

export class DbService implements INonDomainService<'db'> {
  readonly id = 'db'
  readonly deps = ['ipc', 'network'] as const
  readonly hooks = createDbHooks()

  // Database infrastructure
  private sqlite!: Database.Database
  client!: BetterSQLite3Database<typeof schema>
  private dbPath!: string
  private storageDir!: string

  // First-level capabilities
  attachment!: AttachmentStore
  private thumbnail!: ThumbnailStore
  entityFinder!: EntityFinderHelper
  curation!: DbCuration
  fts!: FtsStore
  sql!: SqlExecutor
  settings!: SettingsStore
  private trigger!: TriggerStore
  private feed!: DbChangeFeed

  // ==================== Lifecycle ====================

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.dbPath = path.join(app.getPath('userData'), 'database/kisaki.db')
    this.storageDir = path.join(app.getPath('userData'), 'database/storage')

    await mkdir(path.dirname(this.dbPath), { recursive: true })
    await mkdir(this.storageDir, { recursive: true })

    this.sqlite = new Database(this.dbPath)
    this.sqlite.pragma('journal_mode = WAL')
    this.client = drizzle(this.sqlite, { schema })

    // Persisted triggers are runtime-owned (FTS sync, plus change triggers from
    // versions that persisted them); drop them before migrations so ALTER TABLE
    // never fails on trigger column references.
    dropAllTriggers(this.sqlite)

    // better-sqlite3 enables foreign keys by default, and the migrator runs all
    // pending migrations inside one transaction where `PRAGMA foreign_keys=OFF`
    // written in a migration file is a no-op. A rebuild-style migration would
    // then cascade-delete every child row of the dropped table, so enforcement
    // is suspended around the whole migration run instead (pragmas only take
    // effect outside a transaction) and integrity is checked afterwards.
    this.sqlite.pragma('foreign_keys = OFF')
    migrate(this.client, { migrationsFolder: path.join(import.meta.dirname, '../../drizzle') })
    this.sqlite.pragma('foreign_keys = ON')

    const violations = this.sqlite.pragma('foreign_key_check') as unknown[]
    if (violations.length > 0) {
      log.warn('Foreign key check reported violations after migrations.', {
        violationCount: violations.length
      })
    }

    const ipc = container.get('ipc')

    // Initialize the change feed and SQLite change capture before any DB write,
    // so no change escapes the outbox.
    this.feed = new DbChangeFeed(this.sqlite, {
      hooks: this.hooks,
      sendToRenderer: (changes) => ipc.send('db:changed', changes),
      onRowDeleted: (table, id) => {
        this.attachment.cleanupRow(table, id).catch((error) => {
          log.warn('Failed to cleanup attachment storage.', error, { table: table, id: id })
        })
      }
    })
    this.trigger = new TriggerStore(this.sqlite, (change) => this.feed.enqueue(change))
    this.trigger.init()

    // Initialize settings singleton table (after triggers are set up)
    this.client.insert(settings).values({ id: 0 }).onConflictDoNothing().run()

    const network = container.get('network')

    // Initialize first-level capabilities
    this.thumbnail = new ThumbnailStore()
    this.attachment = new AttachmentStore(this.client, this.storageDir, this.thumbnail, network)
    this.entityFinder = new EntityFinderHelper(this.client)
    this.curation = {
      merge: new EntityMergeCoordinator(this.client, this.attachment, this.hooks, ipc),
      delete: new EntityDeleteCoordinator(this.client)
    }
    this.fts = new FtsStore(this.sqlite)
    this.sql = new SqlExecutor(this.sqlite)
    this.settings = new SettingsStore(this.client)

    // Initialize FTS5 tables and triggers
    this.fts.init()

    await this.attachment.reconcileStorage()

    this.backfillTagNormalizedNames()

    registerAttachmentProtocol({ attachment: this.attachment, thumbnail: this.thumbnail })
    registerDbIpc(this, ipc)

    log.info('Database initialized.', { dbPath: this.dbPath })
  }

  /**
   * Fills `tags.normalized_name` for rows written before the column existed.
   * Normalization is NFKC + case folding, which SQLite cannot express, so the
   * backfill runs in JS. Every tag name must carry identity; rows whose name
   * normalizes to '' are unsupported and deleted with their links. Idempotent:
   * only rows with an empty normalized name are touched.
   */
  private backfillTagNormalizedNames(): void {
    const pending = this.client
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(eq(tags.normalizedName, ''))
      .all()

    if (pending.length === 0) return

    let removed = 0
    this.client.transaction((tx) => {
      for (const tag of pending) {
        if (normalizeKeyText(tag.name)) {
          tx.update(tags).set({ normalizedName: tag.name }).where(eq(tags.id, tag.id)).run()
        } else {
          tx.delete(tags).where(eq(tags.id, tag.id)).run()
          removed++
        }
      }
    })

    log.info('Backfilled tag normalized names.', { filled: pending.length - removed, removed })
  }

  async dispose(): Promise<void> {
    this.deliverPendingChanges()
    this.trigger?.dispose()
    this.feed?.dispose()
    this.attachment?.dispose()
    this.thumbnail?.dispose()
    if (this.sqlite) {
      this.sqlite.close()
      log.info('Database connection closed')
    }
  }

  /**
   * Delivers changes captured just before shutdown, so row deletions still
   * reach attachment cleanup instead of being dropped with the debounce timer.
   */
  private deliverPendingChanges(): void {
    try {
      this.trigger?.drain()
      this.feed?.flush()
    } catch (error) {
      log.warn('Failed to deliver pending database changes on shutdown.', error)
    }
  }
}
