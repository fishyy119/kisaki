import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { safeStorage } from 'electron'
import { Mutex } from 'async-mutex'
import fse from 'fs-extra'
import { createLogger } from '@main/log'
import {
  createUnavailableError,
  createValidationError,
  type ExtensionRuntimeHandle,
  type ExtensionRuntimeMetadata,
  type SerializableValue
} from '@kisaki3/extension-api'
import { resolveInsideRoot } from '../shared/path-confinement'

const log = createLogger('Extension')

interface StoredSecretValue {
  version: 1
  encoding: 'electron-safe-storage'
  data: string
}

type StoredSecretDocument = Record<string, StoredSecretValue>

export class ExtensionRuntimeSecrets {
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
  ): Promise<SerializableValue | undefined> {
    return this.withLock(runtimeHandle, signal, async () => {
      const document = await this.read(runtimeHandle)
      const entry = document[normalizeKey(key)]
      return entry ? this.decrypt(entry) : undefined
    })
  }

  async set(
    runtimeHandle: ExtensionRuntimeHandle,
    key: string,
    value: SerializableValue,
    signal?: AbortSignal
  ): Promise<void> {
    await this.withLock(runtimeHandle, signal, async (secretsPath) => {
      const normalizedValue = requireSerializableValue(value, 'secrets value')
      const document = await this.read(runtimeHandle)
      document[normalizeKey(key)] = this.encrypt(normalizedValue)
      await this.write(runtimeHandle, secretsPath, document, signal)
    })
  }

  async delete(
    runtimeHandle: ExtensionRuntimeHandle,
    key: string,
    signal?: AbortSignal
  ): Promise<void> {
    await this.withLock(runtimeHandle, signal, async (secretsPath) => {
      const document = await this.read(runtimeHandle)
      delete document[normalizeKey(key)]
      await this.write(runtimeHandle, secretsPath, document, signal)
    })
  }

  async listKeys(
    runtimeHandle: ExtensionRuntimeHandle,
    prefix?: string,
    signal?: AbortSignal
  ): Promise<readonly string[]> {
    return this.withLock(runtimeHandle, signal, async () => {
      const document = await this.read(runtimeHandle)
      return Object.keys(document).filter((key) => (prefix ? key.startsWith(prefix) : true))
    })
  }

  private async read(runtimeHandle: ExtensionRuntimeHandle): Promise<StoredSecretDocument> {
    const secretsPath = this.getSecretsPath(this.requireRuntimeHandle(runtimeHandle))
    await fse.ensureDir(path.dirname(secretsPath))

    if (!(await fse.pathExists(secretsPath))) {
      return {}
    }

    try {
      const raw = await fse.readJson(secretsPath)
      return normalizeStoredSecretDocument(raw)
    } catch (error) {
      log.warn('Failed to read extension secrets document, using empty document.', error, {
        runtimeHandle: runtimeHandle
      })
      return {}
    }
  }

  private async write(
    runtimeHandle: ExtensionRuntimeHandle,
    secretsPath: string,
    document: StoredSecretDocument,
    signal?: AbortSignal
  ): Promise<void> {
    this.requireActiveRequest(runtimeHandle, secretsPath, signal)
    await fse.ensureDir(path.dirname(secretsPath))

    const tempPath = resolveInsideRoot(
      path.dirname(secretsPath),
      `${path.basename(secretsPath)}.${randomUUID()}.tmp`
    )

    try {
      await fse.writeJson(tempPath, document, { spaces: 2 })
      this.requireActiveRequest(runtimeHandle, secretsPath, signal)
      await fse.move(tempPath, secretsPath, { overwrite: true })
    } finally {
      await fse.remove(tempPath).catch(() => undefined)
    }
  }

  private encrypt(value: SerializableValue): StoredSecretValue {
    this.requireEncryptionAvailable()
    const plaintext = JSON.stringify(value)
    return {
      version: 1,
      encoding: 'electron-safe-storage',
      data: safeStorage.encryptString(plaintext).toString('base64')
    }
  }

  private decrypt(entry: StoredSecretValue): SerializableValue | undefined {
    this.requireEncryptionAvailable()

    try {
      const plaintext = safeStorage.decryptString(Buffer.from(entry.data, 'base64'))
      return normalizeSerializableValue(JSON.parse(plaintext))
    } catch (error) {
      log.warn('Failed to decrypt extension secret:', error)
      return undefined
    }
  }

  private requireEncryptionAvailable(): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw createUnavailableError('Extension secrets are unavailable on this system.')
    }
  }

  private getSecretsPath(extension: ExtensionRuntimeMetadata): string {
    return resolveInsideRoot(extension.dataPath, 'secrets.json')
  }

  private getMutex(secretsPath: string): Mutex {
    let mutex = this.mutexes.get(secretsPath)
    if (!mutex) {
      mutex = new Mutex()
      this.mutexes.set(secretsPath, mutex)
    }

    return mutex
  }

  private async withLock<T>(
    runtimeHandle: ExtensionRuntimeHandle,
    signal: AbortSignal | undefined,
    callback: (secretsPath: string) => Promise<T> | T
  ): Promise<T> {
    const secretsPath = this.getSecretsPath(this.requireRuntimeHandle(runtimeHandle))

    return this.getMutex(secretsPath).runExclusive(async () => {
      this.requireActiveRequest(runtimeHandle, secretsPath, signal)
      const result = await callback(secretsPath)
      this.requireActiveRequest(runtimeHandle, secretsPath, signal)
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
    secretsPath: string,
    signal?: AbortSignal
  ): void {
    if (signal?.aborted) {
      throw createUnavailableError(
        `Secrets request for runtime handle "${runtimeHandle}" was aborted.`
      )
    }

    const extension = this.requireRuntimeHandle(runtimeHandle)
    if (this.getSecretsPath(extension) !== secretsPath) {
      throw createUnavailableError(
        `Runtime handle "${runtimeHandle}" no longer owns its secrets path.`
      )
    }
  }
}

function normalizeKey(key: string): string {
  const normalized = key.trim()
  if (!normalized) {
    throw createValidationError('Secret key must be a non-empty string.')
  }
  return normalized
}

function normalizeStoredSecretDocument(value: unknown): StoredSecretDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const document: StoredSecretDocument = {}
  for (const [key, entry] of Object.entries(value)) {
    if (isStoredSecretValue(entry)) {
      document[key] = entry
    }
  }
  return document
}

function isStoredSecretValue(value: unknown): value is StoredSecretValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    record.version === 1 &&
    record.encoding === 'electron-safe-storage' &&
    typeof record.data === 'string'
  )
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
