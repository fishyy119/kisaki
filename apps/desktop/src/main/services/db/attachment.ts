/**
 * Attachment Store
 *
 * Owns the on-disk attachment layout (`<storage>/<table>/<row>/<file>`) and all
 * reads and writes into it, with mutex protection for concurrent access.
 *
 * Table names, row ids and file names reach this module from IPC, the
 * `attachment://` protocol and extension hosts, so every path segment is
 * validated and every resolved path is confined to the storage root.
 */

import { Mutex } from 'async-mutex'
import { eq, getTableColumns, getTableName, is } from 'drizzle-orm'
import { SQLiteTable, getTableConfig, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { nanoid } from 'nanoid'
import { fileTypeFromBuffer } from 'file-type'
import { cp, mkdir, open, rm, stat, writeFile } from 'node:fs/promises'
import { movePath, pathExists } from '@main/utils/fs'
import { createReadStream, createWriteStream, type Stats } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createLogger } from '@main/log'
import type { NetworkService } from '@main/services/network'
import type { ThumbnailStore } from './thumbnail'
import type { AttachmentInput, FileColumns, FilesColumns } from '@shared/db/contracts/attachment'
import type { TableName } from '@shared/db/table-names'
import * as schema from '@shared/db/schema'

const log = createLogger('Db')

const STORAGE_TABLE_NAMES: ReadonlySet<string> = new Set(
  Object.values(schema).flatMap((value) => (is(value, SQLiteTable) ? [getTableName(value)] : []))
)

/** Rejects table names that are not backed by a schema table. */
export function requireStorageTable(tableName: string): TableName {
  if (!STORAGE_TABLE_NAMES.has(tableName)) {
    throw new Error(`Unknown attachment table: ${tableName}`)
  }
  return tableName as TableName
}

/** Id column of a schema table; every attachment-bearing table has one. */
function requireIdColumn(table: SQLiteTable): AnySQLiteColumn {
  const column = getTableColumns(table).id
  if (!column) {
    throw new Error(`Table ${getTableConfig(table).name} has no id column.`)
  }
  return column
}

/** Rejects anything that is not a single, literal path segment. */
function requireSafePathSegment(value: string, label: string): string {
  if (
    !value ||
    value === '.' ||
    value === '..' ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('\0') ||
    value !== path.basename(value)
  ) {
    throw new Error(`Invalid attachment ${label}: ${value}`)
  }
  return value
}

/**
 * Attachment storage manager.
 * Handles file operations with mutex protection for concurrent access.
 */
export class AttachmentStore {
  private mutexMap = new Map<string, Mutex>()
  private mutexLastUsed = new Map<string, number>()
  private cleanerInterval?: ReturnType<typeof setInterval>

  private readonly FILE_DELETE_DELAY_MS = 250
  private readonly FILE_DELETE_MAX_RETRIES = 10
  private readonly FILE_DELETE_RETRY_DELAY_MS = 100

  constructor(
    private readonly db: BetterSQLite3Database<typeof schema>,
    private readonly storageDir: string,
    private readonly thumbnailStore: ThumbnailStore,
    private readonly network: NetworkService
  ) {
    this.startMutexCleaner()
  }

  /**
   * Set a single-file attachment field (e.g. coverFile, photoFile).
   * Replaces the previous file (if any) and deletes it from disk.
   */
  async setFile<TTable extends SQLiteTable>(
    table: TTable,
    rowId: string,
    field: FileColumns<TTable>,
    input: AttachmentInput,
    signal?: AbortSignal
  ): Promise<string> {
    const { fileDir, lockKey, mutex } = this.lockRow(table, rowId)

    return await mutex.runExclusive(async () => {
      try {
        throwIfAborted(signal)
        const record = this.getRow(table, rowId)

        const oldFileName = record[field as string] as string | null | undefined
        const { fileName, filePath } = await this.writeNewFile(fileDir, input, signal)
        try {
          throwIfAborted(signal)
          this.updateRowField(table, rowId, field, fileName)
        } catch (error) {
          await this.deleteFile(fileDir, fileName, { bestEffort: true })
          throw error
        }

        if (oldFileName && oldFileName !== fileName) {
          this.scheduleDeleteFile(fileDir, oldFileName, `setFile:${lockKey}`)
        }

        log.debug('Saved file.', { filePath: filePath })
        return fileName
      } catch (error) {
        log.error('Failed to setFile.', error, { lockKey: lockKey })
        throw new Error('Failed to set attachment file.', { cause: error })
      }
    })
  }

  /**
   * Clear a single-file attachment field and delete the file from disk.
   */
  async clearFile<TTable extends SQLiteTable>(
    table: TTable,
    rowId: string,
    field: FileColumns<TTable>
  ): Promise<void> {
    const { fileDir, lockKey, mutex } = this.lockRow(table, rowId)

    return await mutex.runExclusive(async () => {
      try {
        const record = this.getRow(table, rowId)
        const fileName = record[field as string] as string | null | undefined
        if (!fileName) return

        this.updateRowField(table, rowId, field, null)

        this.scheduleDeleteFile(fileDir, fileName, `clearFile:${lockKey}`)
      } catch (error) {
        log.error('Failed to clearFile.', error, { lockKey: lockKey })
        throw new Error('Failed to clear attachment file.', { cause: error })
      }
    })
  }

  /**
   * Add a file to an array attachment field (e.g. descriptionInlineFiles).
   * Returns the generated fileName.
   */
  async addFile<TTable extends SQLiteTable>(
    table: TTable,
    rowId: string,
    field: FilesColumns<TTable>,
    input: AttachmentInput,
    signal?: AbortSignal
  ): Promise<string> {
    const { fileDir, lockKey, mutex } = this.lockRow(table, rowId)

    return await mutex.runExclusive(async () => {
      try {
        throwIfAborted(signal)
        const record = this.getRow(table, rowId)

        const { fileName, filePath } = await this.writeNewFile(fileDir, input, signal)
        const current = this.coerceStringArray(record[field as string])
        const updated = [...current, fileName]

        try {
          throwIfAborted(signal)
          this.updateRowField(table, rowId, field, updated)
        } catch (error) {
          await this.deleteFile(fileDir, fileName, { bestEffort: true })
          throw error
        }

        log.debug('Added file.', { filePath: filePath })
        return fileName
      } catch (error) {
        log.error('Failed to addFile.', error, { lockKey: lockKey })
        throw new Error('Failed to add attachment file.', { cause: error })
      }
    })
  }

  /**
   * Remove all occurrences of a fileName from an array attachment field
   * and delete the file from disk.
   */
  async removeFile<TTable extends SQLiteTable>(
    table: TTable,
    rowId: string,
    field: FilesColumns<TTable>,
    fileName: string
  ): Promise<void> {
    const { fileDir, lockKey, mutex } = this.lockRow(table, rowId)

    return await mutex.runExclusive(async () => {
      try {
        const record = this.getRow(table, rowId)
        const current = this.coerceStringArray(record[field as string])
        const updated = current.filter((f) => f !== fileName)
        if (updated.length === current.length) return

        this.updateRowField(table, rowId, field, updated)

        this.scheduleDeleteFile(fileDir, fileName, `removeFile:${lockKey}`)
      } catch (error) {
        log.error('Failed to removeFile.', error, { lockKey: lockKey })
        throw new Error('Failed to remove attachment file.', { cause: error })
      }
    })
  }

  /**
   * List files from an array attachment field.
   */
  async listFiles<TTable extends SQLiteTable>(
    table: TTable,
    rowId: string,
    field: FilesColumns<TTable>
  ): Promise<string[]> {
    const { mutex } = this.lockRow(table, rowId)

    return await mutex.runExclusive(async () => {
      const record = this.getRow(table, rowId)
      return this.coerceStringArray(record[field as string])
    })
  }

  /**
   * Clear an array attachment field and delete all files from disk.
   */
  async clearFiles<TTable extends SQLiteTable>(
    table: TTable,
    rowId: string,
    field: FilesColumns<TTable>
  ): Promise<void> {
    const { fileDir, lockKey, mutex } = this.lockRow(table, rowId)

    return await mutex.runExclusive(async () => {
      try {
        const record = this.getRow(table, rowId)
        const current = this.coerceStringArray(record[field as string])

        this.updateRowField(table, rowId, field, [])

        for (const fileName of current) {
          this.scheduleDeleteFile(fileDir, fileName, `clearFiles:${lockKey}`)
        }
      } catch (error) {
        log.error('Failed to clearFiles.', error, { lockKey: lockKey })
        throw new Error('Failed to clear attachment files.', { cause: error })
      }
    })
  }

  async setFileByTableName(
    tableName: TableName,
    rowId: string,
    field: string,
    input: AttachmentInput,
    signal?: AbortSignal
  ): Promise<string> {
    const table = this.getSchemaTableByName(tableName)
    return this.setFile(table, rowId, this.requireFileField(table, field), input, signal)
  }

  async clearFileByTableName(tableName: TableName, rowId: string, field: string): Promise<void> {
    const table = this.getSchemaTableByName(tableName)
    return this.clearFile(table, rowId, this.requireFileField(table, field))
  }

  async addFileByTableName(
    tableName: TableName,
    rowId: string,
    field: string,
    input: AttachmentInput,
    signal?: AbortSignal
  ): Promise<string> {
    const table = this.getSchemaTableByName(tableName)
    return this.addFile(table, rowId, this.requireFilesField(table, field), input, signal)
  }

  async removeFileByTableName(
    tableName: TableName,
    rowId: string,
    field: string,
    fileName: string
  ): Promise<void> {
    const table = this.getSchemaTableByName(tableName)
    return this.removeFile(table, rowId, this.requireFilesField(table, field), fileName)
  }

  async listFilesByTableName(
    tableName: TableName,
    rowId: string,
    field: string
  ): Promise<string[]> {
    const table = this.getSchemaTableByName(tableName)
    return this.listFiles(table, rowId, this.requireFilesField(table, field))
  }

  async clearFilesByTableName(tableName: TableName, rowId: string, field: string): Promise<void> {
    const table = this.getSchemaTableByName(tableName)
    return this.clearFiles(table, rowId, this.requireFilesField(table, field))
  }

  async copyFileBetweenRows(
    tableName: TableName,
    fromRowId: string,
    toRowId: string,
    fileName: string
  ): Promise<string> {
    const fromPath = this.getPath(tableName, fromRowId, fileName)
    const toDir = this.getRowDir(tableName, toRowId)

    const lockKey = this.getRowLockKey(tableName, toRowId)
    const mutex = this.getMutex(lockKey)

    return await mutex.runExclusive(async () => {
      if (!(await pathExists(fromPath))) {
        throw new Error('Attachment file not found.')
      }

      await mkdir(toDir, { recursive: true })

      const copiedFileName = await this.createCopiedFileName(toDir, fileName)
      const toPath = path.join(toDir, copiedFileName)
      await cp(fromPath, toPath, { recursive: true, force: false })
      return copiedFileName
    })
  }

  async cleanupRowFiles(tableName: TableName, rowId: string, fileNames: string[]): Promise<void> {
    const fileDir = this.getRowDir(tableName, rowId)
    const lockKey = this.getRowLockKey(tableName, rowId)
    const mutex = this.getMutex(lockKey)

    return await mutex.runExclusive(async () => {
      for (const fileName of fileNames) {
        await this.deleteFile(fileDir, fileName, { bestEffort: true })
      }
    })
  }

  /**
   * Cleanup storage directory for a deleted row.
   * Owned by the committed-change feed; deletion events are the only trigger.
   */
  async cleanupRow(tableName: TableName, rowId: string): Promise<void> {
    const fileDir = this.getRowDir(tableName, rowId)
    const lockKey = this.getRowLockKey(tableName, rowId)
    const mutex = this.getMutex(lockKey)

    return await mutex.runExclusive(async () => {
      if (!(await pathExists(fileDir))) return

      try {
        await rm(fileDir, { recursive: true, force: true })
        log.debug('Cleaned row dir.', { fileDir: fileDir })
      } catch (error) {
        log.warn('Failed to cleanup row dir.', error, { fileDir: fileDir })
      }
    })
  }

  /**
   * Absolute path to a row's storage directory.
   * @throws When the table is unknown or the row id is not a safe path segment.
   */
  getRowDir(tableName: TableName, rowId: string): string {
    const table = requireStorageTable(tableName)
    requireSafePathSegment(rowId, 'row id')
    return this.requireInsideStorage(path.join(this.storageDir, table, rowId))
  }

  /**
   * Absolute path to an attachment file.
   * @throws When the table, row id or file name is not a safe path segment.
   */
  getPath(tableName: TableName, rowId: string, fileName: string): string {
    requireSafePathSegment(fileName, 'file name')
    return this.requireInsideStorage(path.join(this.getRowDir(tableName, rowId), fileName))
  }

  /**
   * Cleanup resources.
   */
  dispose(): void {
    if (this.cleanerInterval) {
      clearInterval(this.cleanerInterval)
    }
    this.mutexMap.clear()
    this.mutexLastUsed.clear()
  }

  /** Validated row directory plus the mutex guarding that row. */
  private lockRow(
    table: SQLiteTable,
    rowId: string
  ): { fileDir: string; lockKey: string; mutex: Mutex } {
    const tableName = requireStorageTable(getTableConfig(table).name)
    const lockKey = this.getRowLockKey(tableName, rowId)
    return {
      fileDir: this.getRowDir(tableName, rowId),
      lockKey,
      mutex: this.getMutex(lockKey)
    }
  }

  /** Last line of defence: no resolved path may leave the storage root. */
  private requireInsideStorage(target: string): string {
    const root = path.resolve(this.storageDir)
    const resolved = path.resolve(target)
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error('Attachment path escapes the storage root.')
    }
    return resolved
  }

  private getMutex(key: string): Mutex {
    if (!this.mutexMap.has(key)) {
      this.mutexMap.set(key, new Mutex())
    }
    this.mutexLastUsed.set(key, Date.now())
    return this.mutexMap.get(key)!
  }

  private getRowLockKey(tableName: string, rowId: string): string {
    return `${tableName}:${rowId}`
  }

  private getSchemaTableByName(tableName: TableName): SQLiteTable {
    const name = requireStorageTable(tableName)
    for (const value of Object.values(schema)) {
      if (is(value, SQLiteTable) && getTableName(value) === name) {
        return value
      }
    }
    throw new Error(`Unknown table: ${tableName}`)
  }

  private requireFileField<TTable extends SQLiteTable>(
    table: TTable,
    field: string
  ): FileColumns<TTable> {
    this.requireAttachmentField(table, field, 'File')
    return field as FileColumns<TTable>
  }

  private requireFilesField<TTable extends SQLiteTable>(
    table: TTable,
    field: string
  ): FilesColumns<TTable> {
    this.requireAttachmentField(table, field, 'Files')
    return field as FilesColumns<TTable>
  }

  private requireAttachmentField(
    table: SQLiteTable,
    field: string,
    suffix: 'File' | 'Files'
  ): void {
    const tableName = getTableConfig(table).name

    if (!field.endsWith(suffix) || !Object.prototype.hasOwnProperty.call(table, field)) {
      throw new Error(`Unknown attachment field: ${tableName}.${field}`)
    }
  }

  private startMutexCleaner(): void {
    const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour
    const MAX_IDLE_TIME = 30 * 60 * 1000 // 30 minutes

    this.cleanerInterval = setInterval(() => {
      const now = Date.now()
      const keysToDelete: string[] = []

      this.mutexLastUsed.forEach((lastUsed, key) => {
        if (now - lastUsed > MAX_IDLE_TIME) {
          const mutex = this.mutexMap.get(key)
          if (mutex && !mutex.isLocked()) {
            keysToDelete.push(key)
          }
        }
      })

      keysToDelete.forEach((key) => {
        this.mutexMap.delete(key)
        this.mutexLastUsed.delete(key)
      })

      if (keysToDelete.length > 0) {
        log.debug('Cleaned up unused mutexes.', { keysToDeleteLength: keysToDelete.length })
      }
    }, CLEANUP_INTERVAL)
  }

  private getRow(table: SQLiteTable, rowId: string): Record<string, unknown> {
    const record = this.db
      .select()
      .from(table)
      .where(eq(requireIdColumn(table), rowId))
      .get()

    if (!record) {
      throw new Error(`Row not found: ${getTableConfig(table).name}:${rowId}`)
    }
    return record as Record<string, unknown>
  }

  /** Writes one column picked at runtime, so the dynamic key stays in one place. */
  private updateRowField(table: SQLiteTable, rowId: string, field: string, value: unknown): void {
    this.db
      .update(table)
      .set({ [field]: value })
      .where(eq(requireIdColumn(table), rowId))
      .run()
  }

  private async writeNewFile(
    fileDir: string,
    input: AttachmentInput,
    signal?: AbortSignal
  ): Promise<{ fileName: string; filePath: string }> {
    throwIfAborted(signal)
    await mkdir(fileDir, { recursive: true })

    switch (input.kind) {
      case 'buffer': {
        const fileBuffer = Buffer.from(input.buffer)
        const fileName = await this.createFileName(fileBuffer, this.getExtHint(input))
        const filePath = path.join(fileDir, fileName)

        try {
          throwIfAborted(signal)
          await writeFile(filePath, fileBuffer)
          throwIfAborted(signal)
          return { fileName, filePath }
        } catch (error) {
          await rm(filePath, { recursive: true, force: true }).catch(() => undefined)
          throw error
        }
      }
      case 'path': {
        const sourcePath = input.path
        if (!path.isAbsolute(sourcePath)) {
          throw new Error(`Attachment path must be absolute: ${sourcePath}`)
        }

        let stats: Stats
        try {
          stats = await stat(sourcePath)
        } catch {
          throw new Error(`Attachment path not found: ${sourcePath}`)
        }

        if (!stats.isFile()) {
          throw new Error(`Attachment path is not a file: ${sourcePath}`)
        }

        const header = await this.readFileHeader(sourcePath)
        const fileName = await this.createFileName(header, this.getExtHint(input))
        const filePath = path.join(fileDir, fileName)

        try {
          throwIfAborted(signal)
          await pipeline(createReadStream(sourcePath), createWriteStream(filePath), { signal })
          throwIfAborted(signal)
          return { fileName, filePath }
        } catch (error) {
          await rm(filePath, { recursive: true, force: true }).catch(() => undefined)
          throw error
        }
      }
      case 'url': {
        const fileId = nanoid()
        const tempPath = path.join(fileDir, `${fileId}.tmp`)
        let finalPath: string | null = null

        try {
          throwIfAborted(signal)
          await this.network.download.toFile(input.url, tempPath, { signal })
          throwIfAborted(signal)
          const header = await this.readFileHeader(tempPath)
          const fileName = await this.createFileNameWithId(fileId, header, this.getExtHint(input))
          const filePath = path.join(fileDir, fileName)
          finalPath = filePath

          throwIfAborted(signal)
          await movePath(tempPath, filePath, { overwrite: true })
          throwIfAborted(signal)
          return { fileName, filePath }
        } catch (error) {
          try {
            await rm(tempPath, { recursive: true, force: true })
          } catch {
            // ignore cleanup errors
          }
          if (finalPath) {
            await rm(finalPath, { recursive: true, force: true }).catch(() => undefined)
          }
          throw error
        }
      }
    }
  }

  private getExtHint(input: AttachmentInput): string | undefined {
    let ext = ''
    if (input.kind === 'path') {
      ext = path.extname(input.path)
    } else if (input.kind === 'url') {
      try {
        const url = new URL(input.url)
        ext = path.posix.extname(url.pathname)
      } catch {
        ext = ''
      }
    }

    if (!ext) return undefined
    if (!/^\.[a-z0-9]{1,10}$/i.test(ext)) return undefined
    return ext
  }

  private async createFileName(fileHeader: Buffer, extHint?: string): Promise<string> {
    return await this.createFileNameWithId(nanoid(), fileHeader, extHint)
  }

  private async createFileNameWithId(
    fileId: string,
    fileHeader: Buffer,
    extHint?: string
  ): Promise<string> {
    const ext = await this.detectExt(fileHeader, extHint)
    return `${fileId}${ext}`
  }

  private async createCopiedFileName(fileDir: string, sourceFileName: string): Promise<string> {
    const ext = path.extname(sourceFileName)
    const safeExt = /^\.[a-z0-9]{1,10}$/i.test(ext) ? ext : ''

    for (let i = 0; i < 5; i++) {
      const fileName = `${nanoid()}${safeExt}`
      if (!(await pathExists(path.join(fileDir, fileName)))) {
        return fileName
      }
    }

    throw new Error('Failed to allocate copied attachment file name.')
  }

  private async detectExt(fileHeader: Buffer, extHint?: string): Promise<string> {
    const fileType = await fileTypeFromBuffer(fileHeader)
    return fileType?.ext ? `.${fileType.ext}` : (extHint ?? '')
  }

  private async readFileHeader(filePath: string, maxBytes = 4100): Promise<Buffer> {
    const handle = await open(filePath, 'r')
    try {
      const buffer = Buffer.alloc(maxBytes)
      const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0)
      return buffer.subarray(0, bytesRead)
    } finally {
      await handle.close()
    }
  }

  private scheduleDeleteFile(fileDir: string, fileName: string, reason: string): void {
    setTimeout(() => {
      this.deleteFile(fileDir, fileName, {
        bestEffort: true,
        maxRetries: this.FILE_DELETE_MAX_RETRIES,
        retryDelayMs: this.FILE_DELETE_RETRY_DELAY_MS
      }).catch((error) => {
        log.warn('Failed to delete file (scheduled).', error, { reason: reason })
      })
    }, this.FILE_DELETE_DELAY_MS)
  }

  private async deleteFile(
    fileDir: string,
    fileName: string,
    options?: { bestEffort?: boolean; maxRetries?: number; retryDelayMs?: number }
  ): Promise<boolean> {
    requireSafePathSegment(fileName, 'file name')
    const filePath = this.requireInsideStorage(path.join(fileDir, fileName))

    const maxRetries = options?.maxRetries ?? 0
    const retryDelay = options?.retryDelayMs ?? 0
    const bestEffort = options?.bestEffort ?? false

    const existed = await pathExists(filePath)
    if (!existed) return false

    try {
      await rm(filePath, { force: true, maxRetries, retryDelay })
      log.debug('Deleted file.', { filePath: filePath })
    } catch (error) {
      if (!bestEffort) throw error
      log.warn('Failed to delete file.', error, { filePath: filePath })
      return false
    }

    await this.thumbnailStore.delete(filePath, fileDir)
    return true
  }

  private coerceStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value.filter((v) => typeof v === 'string') as string[]
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return
  }

  const error = new Error('Attachment operation aborted')
  error.name = 'AbortError'
  throw error
}
