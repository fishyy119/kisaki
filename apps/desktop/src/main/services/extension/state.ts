import path from 'node:path'
import fse from 'fs-extra'
import log from 'electron-log/main'
import type { ExtensionStateDocument, ExtensionStateRecord, ExtensionSourceLocator } from './types'

const EMPTY_STATE: ExtensionStateDocument = {
  version: 1,
  extensions: {}
}

/**
 * Persist extension installation state under userData/extensions/state.json.
 */
export class ExtensionStateStore {
  constructor(private readonly statePath: string) {}

  async init(): Promise<void> {
    await fse.ensureDir(path.dirname(this.statePath))

    if (!(await fse.pathExists(this.statePath))) {
      await this.write(EMPTY_STATE)
    }
  }

  async read(): Promise<ExtensionStateDocument> {
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

  async write(document: ExtensionStateDocument): Promise<void> {
    const normalized = normalizeExtensionStateDocument(document)
    const tempPath = `${this.statePath}.tmp`
    await fse.writeJson(tempPath, normalized, { spaces: 2 })
    await fse.move(tempPath, this.statePath, { overwrite: true })
  }

  async get(id: string): Promise<ExtensionStateRecord | null> {
    const document = await this.read()
    return document.extensions[id] ?? null
  }

  async list(): Promise<Record<string, ExtensionStateRecord>> {
    const document = await this.read()
    return { ...document.extensions }
  }

  async set(id: string, record: ExtensionStateRecord): Promise<void> {
    const document = await this.read()
    document.extensions[id] = normalizeExtensionStateRecord(record) ?? record
    await this.write(document)
  }

  async remove(id: string): Promise<void> {
    const document = await this.read()
    delete document.extensions[id]
    await this.write(document)
  }

  async setEnabled(id: string, enabled: boolean): Promise<ExtensionStateRecord> {
    const document = await this.read()
    const existing = document.extensions[id]

    if (!existing) {
      throw new Error(`Extension "${id}" is not installed`)
    }

    const nextRecord: ExtensionStateRecord = {
      ...existing,
      enabled,
      updatedAt: new Date().toISOString()
    }

    document.extensions[id] = nextRecord
    await this.write(document)
    return nextRecord
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
