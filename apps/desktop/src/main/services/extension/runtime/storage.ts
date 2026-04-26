import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Mutex } from 'async-mutex'
import fse from 'fs-extra'
import log from 'electron-log/main'
import {
  createValidationError,
  createUnavailableError,
  type ExtensionRuntimeHandle,
  type ExtensionRuntimeMetadata,
  type SerializableValue
} from '@kisaki/extension-api'

export class ExtensionRuntimeStorage {
  private readonly mutexes = new Map<string, Mutex>()

  constructor(
    private readonly resolveRuntimeHandle: (
      runtimeHandle: ExtensionRuntimeHandle
    ) => ExtensionRuntimeMetadata | null
  ) {}

  clear(): void {
    this.mutexes.clear()
  }

  async get(
    runtimeHandle: ExtensionRuntimeHandle,
    key: string,
    fallback: SerializableValue,
    signal?: AbortSignal
  ): Promise<SerializableValue> {
    return this.withLock(runtimeHandle, signal, async () => {
      const normalizedFallback = requireSerializableValue(fallback, 'storage fallback')
      const storage = await this.read(runtimeHandle)
      return key in storage ? storage[key] : normalizedFallback
    })
  }

  async set(
    runtimeHandle: ExtensionRuntimeHandle,
    key: string,
    value: SerializableValue,
    signal?: AbortSignal
  ): Promise<void> {
    await this.withLock(runtimeHandle, signal, async (storagePath) => {
      const normalizedValue = requireSerializableValue(value, 'storage value')
      const storage = await this.read(runtimeHandle)
      storage[key] = normalizedValue
      await this.write(runtimeHandle, storagePath, storage, signal)
    })
  }

  async delete(
    runtimeHandle: ExtensionRuntimeHandle,
    key: string,
    signal?: AbortSignal
  ): Promise<void> {
    await this.withLock(runtimeHandle, signal, async (storagePath) => {
      const storage = await this.read(runtimeHandle)
      delete storage[key]
      await this.write(runtimeHandle, storagePath, storage, signal)
    })
  }

  async listKeys(
    runtimeHandle: ExtensionRuntimeHandle,
    prefix?: string,
    signal?: AbortSignal
  ): Promise<readonly string[]> {
    return this.withLock(runtimeHandle, signal, async () => {
      const storage = await this.read(runtimeHandle)
      return Object.keys(storage).filter((key) => (prefix ? key.startsWith(prefix) : true))
    })
  }

  private async read(
    runtimeHandle: ExtensionRuntimeHandle
  ): Promise<Record<string, SerializableValue>> {
    const storagePath = this.getStoragePath(this.requireRuntimeHandle(runtimeHandle))
    await fse.ensureDir(path.dirname(storagePath))

    if (!(await fse.pathExists(storagePath))) {
      return {}
    }

    try {
      const raw = await fse.readJson(storagePath)
      return normalizeSerializableRecord(raw)
    } catch (error) {
      log.warn(
        `[RuntimeStorage] Failed to read storage for runtime handle "${runtimeHandle}", using empty document:`,
        error
      )
      return {}
    }
  }

  private async write(
    runtimeHandle: ExtensionRuntimeHandle,
    storagePath: string,
    document: Record<string, SerializableValue>,
    signal?: AbortSignal
  ): Promise<void> {
    this.requireActiveRequest(runtimeHandle, storagePath, signal)
    await fse.ensureDir(path.dirname(storagePath))

    const tempPath = path.join(
      path.dirname(storagePath),
      `${path.basename(storagePath)}.${randomUUID()}.tmp`
    )

    try {
      await fse.writeJson(tempPath, document, { spaces: 2 })
      this.requireActiveRequest(runtimeHandle, storagePath, signal)
      await fse.move(tempPath, storagePath, { overwrite: true })
    } finally {
      await fse.remove(tempPath).catch(() => undefined)
    }
  }

  private getStoragePath(extension: ExtensionRuntimeMetadata): string {
    return path.join(extension.dataPath, 'storage.json')
  }

  private getMutex(storagePath: string): Mutex {
    let mutex = this.mutexes.get(storagePath)
    if (!mutex) {
      mutex = new Mutex()
      this.mutexes.set(storagePath, mutex)
    }

    return mutex
  }

  private async withLock<T>(
    runtimeHandle: ExtensionRuntimeHandle,
    signal: AbortSignal | undefined,
    callback: (storagePath: string) => Promise<T> | T
  ): Promise<T> {
    const storagePath = this.getStoragePath(this.requireRuntimeHandle(runtimeHandle))

    return this.getMutex(storagePath).runExclusive(async () => {
      this.requireActiveRequest(runtimeHandle, storagePath, signal)
      const result = await callback(storagePath)
      this.requireActiveRequest(runtimeHandle, storagePath, signal)
      return result
    })
  }

  private requireRuntimeHandle(runtimeHandle: ExtensionRuntimeHandle): ExtensionRuntimeMetadata {
    const extension = this.resolveRuntimeHandle(runtimeHandle)
    if (!extension) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return extension
  }

  private requireActiveRequest(
    runtimeHandle: ExtensionRuntimeHandle,
    storagePath: string,
    signal?: AbortSignal
  ): void {
    if (signal?.aborted) {
      throw createUnavailableError(
        `Storage request for runtime handle "${runtimeHandle}" was aborted.`
      )
    }

    const extension = this.requireRuntimeHandle(runtimeHandle)
    if (this.getStoragePath(extension) !== storagePath) {
      throw createUnavailableError(
        `Runtime handle "${runtimeHandle}" no longer owns its storage path.`
      )
    }
  }
}

function normalizeSerializableRecord(value: unknown): Record<string, SerializableValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const result: Record<string, SerializableValue> = {}
  for (const [key, entry] of Object.entries(value)) {
    const normalized = normalizeSerializableValue(entry)
    if (normalized !== undefined) {
      result[key] = normalized
    }
  }
  return result
}

function normalizeSerializableValue(value: unknown): SerializableValue | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  if (Array.isArray(value)) {
    const items: SerializableValue[] = []
    for (const entry of value) {
      const normalized = normalizeSerializableValue(entry)
      if (normalized === undefined) {
        return undefined
      }
      items.push(normalized)
    }
    return items
  }

  if (value && typeof value === 'object') {
    const record: Record<string, SerializableValue> = {}
    for (const [key, entry] of Object.entries(value)) {
      const normalized = normalizeSerializableValue(entry)
      if (normalized === undefined) {
        return undefined
      }
      record[key] = normalized
    }
    return record
  }

  return undefined
}

function requireSerializableValue(value: unknown, label: string): SerializableValue {
  const normalized = normalizeSerializableValue(value)
  if (normalized === undefined) {
    throw createValidationError(`${label} must be JSON serializable with finite number values.`)
  }

  return normalized
}
