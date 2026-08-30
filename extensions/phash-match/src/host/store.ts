/**
 * Read-only pHash index store.
 *
 * The index is a SQLite database that lives in the extension data directory
 * and is read through `node:sqlite`, so the extension carries no native
 * dependencies. Hashes are loaded once into typed arrays for fast linear
 * Hamming scans; full rows are fetched lazily by rowid only for the winning
 * match. The store fingerprints the file (size + mtime) on each access and
 * transparently reloads when the index is replaced, which keeps future
 * remote index updates free of extra wiring.
 *
 * Meta handshake: `meta` rows `format_version`, `algorithm_version`, and
 * `media_type` must match this build; incompatible or unreadable indexes
 * degrade to an empty store and are logged once per file state.
 */

import { statSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import type { ExtensionLogger, ExternalId } from '@kisaki3/extension-sdk'
import { PHASH_ALGORITHM_VERSION, PHASH_BYTE_LENGTH } from './phash'

export const PHASH_INDEX_FORMAT_VERSION = 1

export const GAME_INDEX_FILE_NAME = 'game-index.db'

export const GAME_INDEX_MEDIA_TYPE = 'game'

export interface PhashIndexRecord {
  id: string
  name: string
  externalIds: ExternalId[]
}

export interface PhashIndexMatch {
  record: PhashIndexRecord
  distance: number
}

export interface PhashIndexStoreOptions {
  filePath: string
  logger: ExtensionLogger
}

interface LoadedIndex {
  db: DatabaseSync | null
  rowids: Float64Array
  hashesHi: Uint32Array
  hashesLo: Uint32Array
}

interface IndexRowShape {
  rowid: number
  phash: Uint8Array
}

interface RecordRowShape {
  id: string
  name: string
  external_ids: string
}

const EMPTY_INDEX: LoadedIndex = {
  db: null,
  rowids: new Float64Array(0),
  hashesHi: new Uint32Array(0),
  hashesLo: new Uint32Array(0)
}

export class PhashIndexStore {
  private loaded: LoadedIndex | null = null
  private fingerprint: string | null = null

  constructor(private readonly options: PhashIndexStoreOptions) {}

  get size(): number {
    return this.load().rowids.length
  }

  /** Finds the closest index entry across all probe hashes within maxDistance. */
  findBestMatch(probes: readonly bigint[], maxDistance: number): PhashIndexMatch | null {
    const index = this.load()
    const count = index.rowids.length
    if (count === 0 || probes.length === 0) {
      return null
    }

    let bestDistance = maxDistance + 1
    let bestRow = -1

    scan: for (const probe of probes) {
      const probeHi = Number((probe >> 32n) & 0xffffffffn)
      const probeLo = Number(probe & 0xffffffffn)

      for (let i = 0; i < count; i += 1) {
        const distance =
          popcount32(index.hashesHi[i]! ^ probeHi) + popcount32(index.hashesLo[i]! ^ probeLo)
        if (distance < bestDistance) {
          bestDistance = distance
          bestRow = i
          if (distance === 0) {
            break scan
          }
        }
      }
    }

    if (bestRow < 0) {
      return null
    }

    const record = this.readRecord(index, index.rowids[bestRow]!)
    return record ? { record, distance: bestDistance } : null
  }

  dispose(): void {
    this.loaded?.db?.close()
    this.loaded = null
    this.fingerprint = null
  }

  private load(): LoadedIndex {
    const fingerprint = readFileFingerprint(this.options.filePath)
    if (this.loaded && fingerprint === this.fingerprint) {
      return this.loaded
    }

    this.loaded?.db?.close()
    this.fingerprint = fingerprint
    this.loaded = fingerprint === null ? this.openMissingIndex() : this.openIndex()
    return this.loaded
  }

  private openMissingIndex(): LoadedIndex {
    this.options.logger.info('pHash index database is not present; matching is idle.', {
      filePath: this.options.filePath
    })
    return EMPTY_INDEX
  }

  private openIndex(): LoadedIndex {
    let db: DatabaseSync | null = null
    try {
      db = new DatabaseSync(this.options.filePath, { readOnly: true })
      requireCompatibleIndexMeta(db)

      const rows = db
        .prepare('SELECT rowid AS rowid, phash FROM entries')
        .all() as unknown as IndexRowShape[]
      const rowids = new Float64Array(rows.length)
      const hashesHi = new Uint32Array(rows.length)
      const hashesLo = new Uint32Array(rows.length)

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i]!
        if (!(row.phash instanceof Uint8Array) || row.phash.byteLength !== PHASH_BYTE_LENGTH) {
          throw new Error(`Index entry at rowid ${row.rowid} has an invalid phash value.`)
        }

        const view = new DataView(row.phash.buffer, row.phash.byteOffset, PHASH_BYTE_LENGTH)
        rowids[i] = row.rowid
        hashesHi[i] = view.getUint32(0, false)
        hashesLo[i] = view.getUint32(4, false)
      }

      this.options.logger.info('Loaded pHash index.', { entryCount: rows.length })
      return { db, rowids, hashesHi, hashesLo }
    } catch (error) {
      db?.close()
      this.options.logger.warn('Failed to load pHash index database; matching is idle.', {
        message: error instanceof Error ? error.message : String(error)
      })
      return EMPTY_INDEX
    }
  }

  private readRecord(index: LoadedIndex, rowid: number): PhashIndexRecord | null {
    if (!index.db) {
      return null
    }

    try {
      const row = index.db
        .prepare('SELECT id, name, external_ids FROM entries WHERE rowid = ?')
        .get(rowid) as unknown as RecordRowShape | undefined
      if (!row) {
        return null
      }

      return {
        id: row.id,
        name: row.name,
        externalIds: parseExternalIds(row.external_ids)
      }
    } catch (error) {
      this.options.logger.warn('Failed to read a matched pHash index entry.', {
        message: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }
}

function readFileFingerprint(filePath: string): string | null {
  try {
    const stats = statSync(filePath)
    return `${stats.size}:${stats.mtimeMs}`
  } catch {
    return null
  }
}

function requireCompatibleIndexMeta(db: DatabaseSync): void {
  const meta = new Map<string, string>()
  const rows = db.prepare('SELECT key, value FROM meta').all() as unknown as Array<{
    key: string
    value: string
  }>
  for (const row of rows) {
    meta.set(row.key, row.value)
  }

  requireMetaValue(meta, 'format_version', String(PHASH_INDEX_FORMAT_VERSION))
  requireMetaValue(meta, 'algorithm_version', String(PHASH_ALGORITHM_VERSION))
  requireMetaValue(meta, 'media_type', GAME_INDEX_MEDIA_TYPE)
}

function requireMetaValue(meta: Map<string, string>, key: string, expected: string): void {
  const actual = meta.get(key)
  if (actual !== expected) {
    throw new Error(
      `Index meta "${key}" is "${actual ?? 'missing'}" but "${expected}" is required.`
    )
  }
}

function parseExternalIds(json: string): ExternalId[] {
  try {
    const parsed = JSON.parse(json) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (value): value is ExternalId =>
        typeof value === 'object' &&
        value !== null &&
        typeof (value as ExternalId).source === 'string' &&
        typeof (value as ExternalId).id === 'string'
    )
  } catch {
    return []
  }
}

function popcount32(value: number): number {
  let x = value >>> 0
  x -= (x >>> 1) & 0x55555555
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333)
  x = (x + (x >>> 4)) & 0x0f0f0f0f
  return (x * 0x01010101) >>> 24
}
