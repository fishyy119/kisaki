import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { safeStorage } from 'electron'
import { Mutex } from 'async-mutex'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { movePath, pathExists } from '@main/utils/fs'
import { createLogger } from '@main/log'
import {
  createUnavailableError,
  createValidationError,
  toJsonValue,
  type ExtensionRuntimeHandle,
  type ExtensionRuntimeMetadata,
  type JsonValue
} from '@kisaki3/extension-api'
import { resolveInsideRoot } from '../shared/path-confinement'

const log = createLogger('Extension')

/** Secrets hold credentials and tokens, so single values stay small. */
const SECRET_VALUE_MAX_BYTES = 64 * 1024

/** Cap for the whole secrets.json document, which is rewritten on every set. */
const SECRET_DOCUMENT_MAX_BYTES = 1024 * 1024

interface StoredSecretValue {
  version: 1
  encoding: 'electron-safe-storage'
  ciphertext: string
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
  ): Promise<JsonValue | undefined> {
    return this.withLock(runtimeHandle, signal, async () => {
      const document = await this.read(runtimeHandle)
      const entry = document[normalizeKey(key)]
      return entry ? this.decrypt(entry) : undefined
    })
  }

  async set(
    runtimeHandle: ExtensionRuntimeHandle,
    key: string,
    value: JsonValue,
    signal?: AbortSignal
  ): Promise<void> {
    await this.withLock(runtimeHandle, signal, async (secretsPath) => {
      // Canonicalize at the disk boundary: the persisted document must stay
      // pure JSON regardless of which main-side caller produced the value.
      const normalizedValue = toJsonValue(value, 'secrets value')
      if (Buffer.byteLength(JSON.stringify(normalizedValue), 'utf8') > SECRET_VALUE_MAX_BYTES) {
        throw createValidationError(
          `Secret value for key "${key}" exceeds ${SECRET_VALUE_MAX_BYTES} bytes.`
        )
      }

      const document = await this.read(runtimeHandle)
      document[normalizeKey(key)] = this.encrypt(normalizedValue)
      if (Buffer.byteLength(JSON.stringify(document), 'utf8') > SECRET_DOCUMENT_MAX_BYTES) {
        throw createValidationError(
          `Extension secrets document exceeds ${SECRET_DOCUMENT_MAX_BYTES} bytes.`
        )
      }

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
    await mkdir(path.dirname(secretsPath), { recursive: true })

    if (!(await pathExists(secretsPath))) {
      return {}
    }

    try {
      const raw = JSON.parse(await readFile(secretsPath, 'utf8'))
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
    await mkdir(path.dirname(secretsPath), { recursive: true })

    const tempPath = resolveInsideRoot(
      path.dirname(secretsPath),
      `${path.basename(secretsPath)}.${randomUUID()}.tmp`
    )

    try {
      await writeFile(tempPath, `${JSON.stringify(document, null, 2)}\n`)
      this.requireActiveRequest(runtimeHandle, secretsPath, signal)
      await movePath(tempPath, secretsPath, { overwrite: true })
    } finally {
      await rm(tempPath, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  private encrypt(value: JsonValue): StoredSecretValue {
    this.requireEncryptionAvailable()
    const plaintext = JSON.stringify(value)
    return {
      version: 1,
      encoding: 'electron-safe-storage',
      ciphertext: safeStorage.encryptString(plaintext).toString('base64')
    }
  }

  private decrypt(entry: StoredSecretValue): JsonValue | undefined {
    this.requireEncryptionAvailable()

    try {
      const plaintext = safeStorage.decryptString(Buffer.from(entry.ciphertext, 'base64'))
      return toJsonValue(JSON.parse(plaintext), 'secrets value')
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
    typeof record.ciphertext === 'string'
  )
}
