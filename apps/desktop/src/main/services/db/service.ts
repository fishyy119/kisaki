/**
 * Database Service
 *
 * Unified database service that provides:
 * - Database connection and lifecycle management
 * - Entity lookup and deletion helpers
 * - Attachment storage (via attachment sub-store)
 * - Thumbnail generation (via thumbnail sub-store)
 */

import Database from 'better-sqlite3'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { app, net, protocol } from 'electron'
import { pathToFileURL } from 'url'
import fse from 'fs-extra'
import path from 'path'
import { createLogger } from '@main/log'
import * as schema from '@shared/db'
import { settings } from '@shared/db'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { AttachmentStore } from './attachment'
import { ThumbnailStore } from './thumbnail'
import { DbEntityDeleteHelper, DbEntityFinderHelper } from './helper'
import { FtsStore } from './fts'
import { TriggerStore } from './trigger'
import { DbEventProjector } from './projector'
import { registerDbIpc } from './ipc'
import { SqlExecutor } from './sql'

const log = createLogger('Db')

// Re-export types
export type { ThumbnailOptions, ThumbnailFit, FileColumns, FilesColumns } from './types'

/** Image extensions that support thumbnails */
const THUMBNAIL_SUPPORTED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
  '.tiff',
  '.tif'
])

export class DbService implements IService {
  readonly id = 'db'
  readonly deps = ['event', 'ipc', 'network'] as const satisfies readonly ServiceName[]

  // Database infrastructure
  private sqlite!: Database.Database
  client!: BetterSQLite3Database<typeof schema>
  private dbPath!: string
  private storageDir!: string

  // First-level capabilities
  attachment!: AttachmentStore
  private thumbnail!: ThumbnailStore
  entityFinder!: DbEntityFinderHelper
  entityDelete!: DbEntityDeleteHelper
  fts!: FtsStore
  sql!: SqlExecutor
  private trigger!: TriggerStore
  private projector!: DbEventProjector

  // ==================== Lifecycle ====================

  async init(container: ServiceInitContainer<this>): Promise<void> {
    this.dbPath = path.join(app.getPath('userData'), 'database/kisaki.db')
    this.storageDir = path.join(app.getPath('userData'), 'database/storage')

    await fse.mkdir(path.dirname(this.dbPath), { recursive: true })
    await fse.mkdir(this.storageDir, { recursive: true })

    this.sqlite = new Database(this.dbPath)
    this.sqlite.pragma('journal_mode = WAL')
    this.client = drizzle(this.sqlite, { schema })

    // Run migrations
    migrate(this.client, { migrationsFolder: path.join(__dirname, '../../drizzle') })

    // Initialize SQLite triggers for automatic event emission
    // IMPORTANT: Must register emit_db_change function BEFORE any DB writes
    // because triggers persist in SQLite and may already exist from previous runs
    const event = container.get('event')
    this.trigger = new TriggerStore(this.sqlite, event)
    this.trigger.init()
    this.projector = new DbEventProjector(this.sqlite, event)
    this.projector.init()

    // Initialize settings singleton table (after triggers are set up)
    this.client.insert(settings).values({ id: 0 }).onConflictDoNothing().run()

    const network = container.get('network')

    // Initialize first-level capabilities
    this.thumbnail = new ThumbnailStore()
    this.attachment = new AttachmentStore(this.client, this.storageDir, this.thumbnail, network)
    this.entityFinder = new DbEntityFinderHelper(this.client)
    this.entityDelete = new DbEntityDeleteHelper(this.client)
    this.fts = new FtsStore(this.sqlite)
    this.sql = new SqlExecutor(this.sqlite)

    // Initialize FTS5 tables and triggers
    this.fts.init()

    // Cleanup attachment storage on row deletion (applies to all tables)
    event.on('db:deleted', ({ table, id }) => {
      this.attachment.cleanupRow(table, id).catch((error) => {
        log.warn('Failed to cleanup attachment storage.', error, { table: table, id: id })
      })
    })

    // Setup attachment:// protocol handler
    this.setupAttachmentProtocol()

    // Register IPC handlers
    const ipc = container.get('ipc')
    registerDbIpc(this, ipc)

    log.info('Database initialized.', { dbPath: this.dbPath })
  }

  private setupAttachmentProtocol(): void {
    protocol.handle('attachment', async (request) => {
      try {
        // Parse URL: attachment://tableName/rowId/fileName?w=240&h=320
        const url = new URL(request.url)
        const tableName = url.hostname
        const pathParts = url.pathname.split('/').filter(Boolean)

        if (pathParts.length < 2) {
          return new Response('Invalid attachment path', { status: 400 })
        }

        const rowId = pathParts[0]
        const fileName = pathParts.slice(1).join('/')

        // Build file path
        const fileDir = path.join(this.storageDir, tableName, rowId)
        const filePath = path.join(fileDir, fileName)

        if (!(await fse.pathExists(filePath))) {
          return new Response('Attachment not found', { status: 404 })
        }

        // Check for thumbnail request
        const thumbnailOptions = this.thumbnail.parseOptions(url.searchParams)
        const fileExt = path.extname(fileName).toLowerCase()

        if (thumbnailOptions && THUMBNAIL_SUPPORTED_EXTENSIONS.has(fileExt)) {
          try {
            const thumbnailPath = await this.thumbnail.getOrCreate(
              filePath,
              fileDir,
              thumbnailOptions
            )
            const thumbnailUrl = pathToFileURL(thumbnailPath).toString()
            return await net.fetch(thumbnailUrl)
          } catch (error) {
            log.warn('Thumbnail generation failed, falling back to original.', error, {
              fileName
            })
          }
        }

        const fileUrl = pathToFileURL(filePath).toString()
        return await net.fetch(fileUrl)
      } catch (error) {
        log.error('Attachment protocol failed.', error)
        return new Response('Failed to load attachment', { status: 500 })
      }
    })
  }

  async dispose(): Promise<void> {
    this.projector?.dispose()
    this.attachment?.dispose()
    this.thumbnail?.dispose()
    if (this.sqlite) {
      this.sqlite.close()
      log.info('Database connection closed')
    }
  }
}
