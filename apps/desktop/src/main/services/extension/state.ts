import path from 'node:path'
import { randomUUID } from 'node:crypto'
import fse from 'fs-extra'
import log from 'electron-log/main'
import { Mutex } from 'async-mutex'
import { isExtensionIdentifier } from '@kisaki/extension-api'
import type { ExtensionStateDocument, ExtensionStateRecord, ExtensionSourceLocator } from './types'
import { requireSafeExtensionId } from './shared/path-confinement'

const EMPTY_STATE: ExtensionStateDocument = {
  version: 1,
  extensions: {}
}

/**
 * Persist extension installation state under userData/extensions/state.json.
 */
export class ExtensionStateStore {
  private readonly mutex = new Mutex()

  constructor(private readonly statePath: string) {}

  async init(): Promise<void> {
    await fse.ensureDir(path.dirname(this.statePath))

    if (!(await fse.pathExists(this.statePath))) {
      await this.write(EMPTY_STATE)
    }
  }

  async read(): Promise<ExtensionStateDocument> {
    return this.mutex.runExclusive(() => this.readUnlocked())
  }

  async write(document: ExtensionStateDocument): Promise<void> {
    await this.mutex.runExclusive(() => this.writeUnlocked(document))
  }

  async get(id: string): Promise<ExtensionStateRecord | null> {
    const extensionId = requireSafeExtensionId(id)
    return this.mutex.runExclusive(async () => {
      const document = await this.readUnlocked()
      return document.extensions[extensionId] ?? null
    })
  }

  async list(): Promise<Record<string, ExtensionStateRecord>> {
    return this.mutex.runExclusive(async () => {
      const document = await this.readUnlocked()
      return { ...document.extensions }
    })
  }

  async set(id: string, record: ExtensionStateRecord): Promise<void> {
    const extensionId = requireSafeExtensionId(id)
    await this.mutex.runExclusive(async () => {
      const document = await this.readUnlocked()
      document.extensions[extensionId] = normalizeExtensionStateRecord(record) ?? record
      await this.writeUnlocked(document)
    })
  }

  async remove(id: string): Promise<void> {
    const extensionId = requireSafeExtensionId(id)
    await this.mutex.runExclusive(async () => {
      const document = await this.readUnlocked()
      delete document.extensions[extensionId]
      await this.writeUnlocked(document)
    })
  }

  async setEnabled(id: string, enabled: boolean): Promise<ExtensionStateRecord> {
    const extensionId = requireSafeExtensionId(id)
    return this.mutex.runExclusive(async () => {
      const document = await this.readUnlocked()
      const existing = document.extensions[extensionId]

      if (!existing) {
        throw new Error(`Extension "${extensionId}" is not installed`)
      }

      const nextRecord: ExtensionStateRecord = {
        ...existing,
        enabled,
        updatedAt: new Date().toISOString()
      }

      document.extensions[extensionId] = nextRecord
      await this.writeUnlocked(document)
      return nextRecord
    })
  }

  private async readUnlocked(): Promise<ExtensionStateDocument> {
    try {
      const raw = await fse.readJson(this.statePath)
      return normalizeExtensionStateDocument(raw)
    } catch (error) {
      log.warn(
        '[ExtensionStateStore] Failed to read state.json, falling back to empty state:',
        error
      )
      return cloneEmptyState()
    }
  }

  private async writeUnlocked(document: ExtensionStateDocument): Promise<void> {
    const normalized = normalizeExtensionStateDocument(document)
    const tempPath = `${this.statePath}.${randomUUID()}.tmp`
    await fse.writeJson(tempPath, normalized, { spaces: 2 })
    await fse.move(tempPath, this.statePath, { overwrite: true })
  }
}

function cloneEmptyState(): ExtensionStateDocument {
  return {
    version: 1,
    extensions: {}
  }
}

function normalizeExtensionStateDocument(value: unknown): ExtensionStateDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return cloneEmptyState()
  }

  const rawVersion = (value as { version?: unknown }).version
  const rawExtensions = (value as { extensions?: unknown }).extensions

  const extensions: Record<string, ExtensionStateRecord> = {}

  if (rawExtensions && typeof rawExtensions === 'object' && !Array.isArray(rawExtensions)) {
    for (const [id, record] of Object.entries(rawExtensions)) {
      if (!isExtensionIdentifier(id)) {
        log.warn(`[ExtensionStateStore] Ignoring invalid state id "${id}"`)
        continue
      }

      const normalized = normalizeExtensionStateRecord(record)
      if (normalized) {
        extensions[id] = normalized
      } else {
        log.warn(`[ExtensionStateStore] Ignoring invalid state record for extension "${id}"`)
      }
    }
  }

  return {
    version: rawVersion === 1 ? 1 : 1,
    extensions
  }
}

function normalizeExtensionStateRecord(value: unknown): ExtensionStateRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as Partial<ExtensionStateRecord> & {
    source?: ExtensionSourceLocator | null | unknown
  }

  if (
    typeof record.enabled !== 'boolean' ||
    typeof record.version !== 'string' ||
    record.version.length === 0 ||
    typeof record.installedAt !== 'string' ||
    record.installedAt.length === 0 ||
    typeof record.updatedAt !== 'string' ||
    record.updatedAt.length === 0
  ) {
    return null
  }

  const source = normalizeExtensionSourceLocator(record.source)

  if (record.source !== undefined && record.source !== null && source === null) {
    return null
  }

  return {
    enabled: record.enabled,
    version: record.version,
    source,
    installedAt: record.installedAt,
    updatedAt: record.updatedAt
  }
}

function normalizeExtensionSourceLocator(value: unknown): ExtensionSourceLocator | null {
  if (value === undefined || value === null) {
    return null
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const locator = value as Partial<ExtensionSourceLocator>

  if (
    typeof locator.provider !== 'string' ||
    locator.provider.length === 0 ||
    typeof locator.locator !== 'string' ||
    locator.locator.length === 0
  ) {
    return null
  }

  return {
    provider: locator.provider,
    locator: locator.locator
  }
}
