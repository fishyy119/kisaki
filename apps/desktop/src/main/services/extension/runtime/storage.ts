import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Mutex } from 'async-mutex'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { movePath, pathExists } from '@main/utils/fs'
import { createLogger } from '@main/log'
import {
  createCancellationError,
  createUnavailableError,
  createValidationError,
  toJsonObject,
  toJsonValue,
  type ExtensionRuntimeHandle,
  type ExtensionRuntimeMetadata,
  type JsonValue
} from '@kisaki3/extension-api'
import { resolveInsideRoot } from '../shared/path-confinement'

const log = createLogger('Extension')

/** Generous per-value cap that still keeps single writes IPC-friendly. */
const STORAGE_VALUE_MAX_BYTES = 1024 * 1024

/** Cap for the whole storage.json document, which is rewritten on every set. */
const STORAGE_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024

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
    signal?: AbortSignal
  ): Promise<JsonValue | undefined> {
    return this.withLock(runtimeHandle, signal, async () => {
      const storage = await this.read(runtimeHandle)
      return storage[key]
    })
  }

  async set(
    runtimeHandle: ExtensionRuntimeHandle,
    key: string,
    value: JsonValue,
    signal?: AbortSignal
  ): Promise<void> {
    await this.withLock(runtimeHandle, signal, async (storagePath) => {
      // Canonicalize at the disk boundary: the persisted document must stay
      // pure JSON regardless of which main-side caller produced the value.
      const normalizedValue = toJsonValue(value, 'storage value')
      if (measureCanonicalJsonBytes(normalizedValue) > STORAGE_VALUE_MAX_BYTES) {
        throw createValidationError(
          `Storage value for key "${key}" exceeds ${STORAGE_VALUE_MAX_BYTES} bytes.`
        )
      }

      const storage = await this.read(runtimeHandle)
      storage[key] = normalizedValue
      if (measureCanonicalJsonBytes(storage) > STORAGE_DOCUMENT_MAX_BYTES) {
        throw createValidationError(
          `Extension storage document exceeds ${STORAGE_DOCUMENT_MAX_BYTES} bytes.`
        )
      }

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

  private async read(runtimeHandle: ExtensionRuntimeHandle): Promise<Record<string, JsonValue>> {
    const storagePath = this.getStoragePath(this.requireRuntimeHandle(runtimeHandle))
    await mkdir(path.dirname(storagePath), { recursive: true })

    if (!(await pathExists(storagePath))) {
      return {}
    }

    try {
      const raw = JSON.parse(await readFile(storagePath, 'utf8'))
      return toJsonObject(raw, 'extension storage document') as Record<string, JsonValue>
    } catch (error) {
      log.warn('Failed to read extension storage document, using empty document.', error, {
        runtimeHandle: runtimeHandle
      })
      return {}
    }
  }

  private async write(
    runtimeHandle: ExtensionRuntimeHandle,
    storagePath: string,
    document: Record<string, JsonValue>,
    signal?: AbortSignal
  ): Promise<void> {
    this.requireActiveRequest(runtimeHandle, storagePath, signal)
    await mkdir(path.dirname(storagePath), { recursive: true })

    const tempPath = resolveInsideRoot(
      path.dirname(storagePath),
      `${path.basename(storagePath)}.${randomUUID()}.tmp`
    )

    try {
      await writeFile(tempPath, `${JSON.stringify(document, null, 2)}\n`)
      this.requireActiveRequest(runtimeHandle, storagePath, signal)
      await movePath(tempPath, storagePath, { overwrite: true })
    } finally {
      await rm(tempPath, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  private getStoragePath(extension: ExtensionRuntimeMetadata): string {
    return resolveInsideRoot(extension.dataPath, 'storage.json')
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
      throw createCancellationError(
        `Storage request for runtime handle "${runtimeHandle}" was cancelled.`
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

/** Measures an already-canonical JSON value without re-normalizing it. */
function measureCanonicalJsonBytes(value: JsonValue): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}
