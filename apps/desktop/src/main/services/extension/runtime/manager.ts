import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import fse from 'fs-extra'
import { Mutex } from 'async-mutex'
import log from 'electron-log/main'
import {
  EXTENSION_API_VERSION,
  EXTENSION_RPC_PROTOCOL_VERSION,
  RpcTimeoutError,
  createUnavailableError,
  normalizeCapabilityError,
  type ExtensionRuntimeChangeCause,
  type ExtensionRuntimeHandle,
  type ExtensionRuntimeMetadata,
  type ExtensionUnloadReason,
  type ExtensionUnloadResult,
  type MainToHostRpcMethod,
  type MainToHostRpcRequestMap,
  type RpcParams,
  type RpcResult,
  type RpcValue,
  type RuntimeInfo,
  type SerializableValue
} from '@kisaki/extension-api'
import { ExtensionHostCrashPolicy } from './crash-policy'
import { ExtensionHostController, type ExtensionHostExitInfo } from './host-controller'
import { ExtensionHostRpcClient } from './rpc-client'
import type { RpcRequestOptions } from './rpc-core'
import type { ExtensionCapabilityGateway } from '../capabilities'
import type { ExtensionContributionRegistry } from '../contributions/registry'

export type { ExtensionRuntimeChangeCause } from '@kisaki/extension-api'

const EMPTY_RPC_RESULT = Object.freeze({})

export interface RuntimeManagerOptions {
  hostModulePath: string
  capabilities?: ExtensionCapabilityGateway
  contributions?: ExtensionContributionRegistry
}

export interface RuntimeReconcileOptions {
  cause?: ExtensionRuntimeChangeCause
  forceReloadIds?: Iterable<string>
}

export interface RuntimeReloadOptions {
  cause?: ExtensionRuntimeChangeCause
}

interface LoadedExtensionState {
  metadata: ExtensionRuntimeMetadata
  runtimeHandle: ExtensionRuntimeHandle
  generation: number
}

/**
 * Main-process facade for the shared extension host lifecycle.
 *
 * Runtime state is reconciled from a desired extension set. Load, unload, reload,
 * package updates, file changes and crash recovery all flow through the same
 * state machine so the main process does not drift from the host process.
 */
export class RuntimeManager {
  private readonly mutex = new Mutex()
  private readonly crashPolicy = new ExtensionHostCrashPolicy()
  private readonly desiredExtensions = new Map<string, ExtensionRuntimeMetadata>()
  private readonly loadedExtensions = new Map<string, LoadedExtensionState>()
  private readonly runtimeHandles = new Map<ExtensionRuntimeHandle, ExtensionRuntimeMetadata>()
  private controller: ExtensionHostController | null = null
  private rpc: ExtensionHostRpcClient | null = null
  private generationCounter = 0
  private handshaken = false

  constructor(private readonly options: RuntimeManagerOptions) {}

  getLoadedExtensions(): ReadonlyMap<string, ExtensionRuntimeMetadata> {
    return mapLoadedMetadata(this.loadedExtensions)
  }

  getDesiredExtensions(): ReadonlyMap<string, ExtensionRuntimeMetadata> {
    return new Map(this.desiredExtensions)
  }

  resolveRuntimeHandle(runtimeHandle: ExtensionRuntimeHandle): ExtensionRuntimeMetadata | null {
    return this.runtimeHandles.get(runtimeHandle) ?? null
  }

  async startHost(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      await this.startHostLocked()
    })
  }

  async handshake(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      await this.handshakeLocked()
    })
  }

  async reconcile(
    desired: ReadonlyMap<string, ExtensionRuntimeMetadata>,
    options: RuntimeReconcileOptions = {}
  ): Promise<void> {
    await this.mutex.runExclusive(async () => {
      this.desiredExtensions.clear()
      for (const [extensionId, metadata] of desired) {
        this.desiredExtensions.set(extensionId, metadata)
      }

      await this.reconcileLocked(options)
    })
  }

  async loadExtension(extension: ExtensionRuntimeMetadata): Promise<void> {
    await this.mutex.runExclusive(async () => {
      this.desiredExtensions.set(extension.id, extension)
      await this.reconcileLocked({ cause: 'enable' })
    })
  }

  async unloadExtension(
    extensionId: string,
    reason: ExtensionUnloadReason = 'shutdown'
  ): Promise<void> {
    await this.mutex.runExclusive(async () => {
      this.desiredExtensions.delete(extensionId)
      await this.unloadFromHostLocked(extensionId, reason)

      if (this.desiredExtensions.size === 0) {
        await this.stopHostLocked({ clearDesired: false })
      }
    })
  }

  async reloadExtension(extensionId: string, options: RuntimeReloadOptions = {}): Promise<void> {
    await this.mutex.runExclusive(async () => {
      if (!this.desiredExtensions.has(extensionId)) {
        throw new Error(`Extension "${extensionId}" is not desired in the runtime manager`)
      }

      await this.reconcileLocked({
        cause: options.cause ?? 'user',
        forceReloadIds: [extensionId]
      })
    })
  }

  async restartHost(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      await this.restartHostLocked('user')
    })
  }

  async shutdownHost(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      await this.stopHostLocked({ clearDesired: true })
    })
  }

  requestHost<K extends MainToHostRpcMethod>(
    method: K,
    params: RpcParams<MainToHostRpcRequestMap, K>,
    options?: RpcRequestOptions
  ): Promise<RpcResult<MainToHostRpcRequestMap, K>> {
    return this.requireRpc().requestHost(method, params, options)
  }

  private async reconcileLocked(options: RuntimeReconcileOptions): Promise<void> {
    const cause = options.cause ?? 'metadata-change'
    const forceReloadIds = new Set(options.forceReloadIds ?? [])

    for (const extensionId of [...this.loadedExtensions.keys()].reverse()) {
      if (!this.desiredExtensions.has(extensionId)) {
        await this.unloadFromHostLocked(extensionId, 'disable')
      }
    }

    if (this.desiredExtensions.size === 0) {
      await this.stopHostLocked({ clearDesired: false })
      return
    }

    await this.ensureHostReadyLocked()

    for (const [extensionId, metadata] of this.desiredExtensions) {
      const loaded = this.loadedExtensions.get(extensionId)

      if (!loaded) {
        await this.loadIntoHostLocked(metadata, cause)
        continue
      }

      if (forceReloadIds.has(extensionId) || !isSameRuntimeMetadata(loaded.metadata, metadata)) {
        await this.reloadInHostLocked(metadata, cause)
      }
    }
  }

  private async loadIntoHostLocked(
    extension: ExtensionRuntimeMetadata,
    cause: ExtensionRuntimeChangeCause
  ): Promise<void> {
    const generation = this.nextGeneration()
    const runtimeHandle = randomUUID()
    this.runtimeHandles.set(runtimeHandle, extension)

    try {
      await this.requestHostLifecycle(
        'extensions.load',
        { extension, runtimeHandle, generation, cause },
        extension.id,
        cause,
        15_000
      )
    } catch (error) {
      this.runtimeHandles.delete(runtimeHandle)
      this.options.capabilities?.releaseRuntime(runtimeHandle)
      this.options.contributions?.releaseRuntime(runtimeHandle)
      throw error
    }

    this.loadedExtensions.set(extension.id, {
      metadata: extension,
      runtimeHandle,
      generation
    })
  }

  private async reloadInHostLocked(
    extension: ExtensionRuntimeMetadata,
    cause: ExtensionRuntimeChangeCause
  ): Promise<void> {
    const previous = this.loadedExtensions.get(extension.id)
    const generation = this.nextGeneration()
    const runtimeHandle = randomUUID()
    this.runtimeHandles.set(runtimeHandle, extension)

    try {
      await this.requestHostLifecycle(
        'extensions.reload',
        { extension, runtimeHandle, generation, cause },
        extension.id,
        cause,
        15_000
      )
    } catch (error) {
      this.runtimeHandles.delete(runtimeHandle)
      this.options.capabilities?.releaseRuntime(runtimeHandle)
      this.options.contributions?.releaseRuntime(runtimeHandle)
      if (previous) {
        this.loadedExtensions.delete(extension.id)
        this.releaseLoadedState(previous)
      }
      throw error
    }

    this.loadedExtensions.set(extension.id, {
      metadata: extension,
      runtimeHandle,
      generation
    })

    if (previous) {
      this.releaseLoadedState(previous)
    }
  }

  private async unloadFromHostLocked(
    extensionId: string,
    reason: ExtensionUnloadReason
  ): Promise<void> {
    const loaded = this.loadedExtensions.get(extensionId)
    if (!loaded) {
      return
    }

    this.loadedExtensions.delete(extensionId)

    if (!this.rpc || !this.controller?.isRunning()) {
      this.releaseLoadedState(loaded)
      return
    }

    try {
      const result = await this.requestHostLifecycle(
        'extensions.unload',
        { extensionId, runtimeHandle: loaded.runtimeHandle, reason },
        extensionId,
        toChangeCause(reason),
        15_000
      )
      logUnloadResult(extensionId, result)
    } catch (error) {
      log.warn(
        `[RuntimeManager] Failed to unload extension "${extensionId}", restarting host to enforce desired state:`,
        error
      )

      if (!(error instanceof RpcTimeoutError)) {
        await this.restartHostLocked('host-timeout', new Set([extensionId]))
      }
    } finally {
      this.releaseLoadedState(loaded)
    }
  }

  private async ensureHostReadyLocked(): Promise<void> {
    await this.startHostLocked()
    await this.handshakeLocked()
  }

  private async startHostLocked(): Promise<void> {
    if (this.controller?.isRunning() && this.rpc) {
      return
    }

    if (!(await fse.pathExists(this.options.hostModulePath))) {
      throw new Error(`Extension host entry was not found at ${this.options.hostModulePath}`)
    }

    const controller = new ExtensionHostController(this.options.hostModulePath)
    const rpc = new ExtensionHostRpcClient((message) => controller.send(message))
    this.installHostRequestHandlers(rpc)

    await controller.start((message) => rpc.onMessage(message))
    controller.onExit((info) => {
      void this.handleHostExit(info).catch((error) => {
        log.error('[RuntimeManager] Failed to process extension host exit:', error)
      })
    })

    this.controller = controller
    this.rpc = rpc
    this.handshaken = false
    log.info('[RuntimeManager] Extension host started')
  }

  private async handshakeLocked(): Promise<void> {
    if (this.handshaken) {
      return
    }

    const runtimeInfo = createRuntimeInfo()
    const response = await this.requireRpc().handshake(
      {
        protocolVersion: EXTENSION_RPC_PROTOCOL_VERSION,
        peerVersion: app.getVersion(),
        metadata: {
          appVersion: runtimeInfo.appVersion,
          apiVersion: runtimeInfo.apiVersion,
          mode: runtimeInfo.mode,
          platform: runtimeInfo.platform,
          arch: runtimeInfo.arch
        }
      },
      { timeoutMs: 10_000 }
    )

    if (!response.accepted) {
      const message = response.error?.message ?? 'Extension host handshake was rejected'
      throw new Error(message)
    }

    this.handshaken = true
    log.info('[RuntimeManager] Extension host handshake completed')
  }

  private installHostRequestHandlers(rpc: ExtensionHostRpcClient): void {
    rpc.handleHostRequest('bridge.logger.log', async (params) => {
      try {
        const extension = this.requireActiveRuntimeHandle(params.runtimeHandle)
        writeExtensionLog(extension.id, params.level, params.message, params.args)
        return EMPTY_RPC_RESULT
      } catch (error) {
        throw normalizeCapabilityError(error, 'Failed to write extension log.')
      }
    })

    rpc.handleHostRequest('bridge.storage.get', async (params) => {
      try {
        const storage = await this.readStorageDocument(params.runtimeHandle)
        const value =
          params.key in storage ? storage[params.key] : (params.fallback as SerializableValue)

        return {
          value
        }
      } catch (error) {
        throw normalizeCapabilityError(error, 'Failed to read extension storage.')
      }
    })

    rpc.handleHostRequest('bridge.storage.set', async (params) => {
      try {
        const storage = await this.readStorageDocument(params.runtimeHandle)
        storage[params.key] = params.value
        await this.writeStorageDocument(params.runtimeHandle, storage)
        return EMPTY_RPC_RESULT
      } catch (error) {
        throw normalizeCapabilityError(error, 'Failed to write extension storage.')
      }
    })

    rpc.handleHostRequest('bridge.storage.delete', async (params) => {
      try {
        const storage = await this.readStorageDocument(params.runtimeHandle)
        delete storage[params.key]
        await this.writeStorageDocument(params.runtimeHandle, storage)
        return EMPTY_RPC_RESULT
      } catch (error) {
        throw normalizeCapabilityError(error, 'Failed to delete extension storage value.')
      }
    })

    rpc.handleHostRequest('bridge.storage.listKeys', async (params) => {
      try {
        const storage = await this.readStorageDocument(params.runtimeHandle)
        const keys = Object.keys(storage).filter((key) =>
          params.prefix ? key.startsWith(params.prefix) : true
        )

        return { keys }
      } catch (error) {
        throw normalizeCapabilityError(error, 'Failed to list extension storage keys.')
      }
    })

    this.options.contributions?.registerRpcHandlers(rpc)
    this.options.capabilities?.registerRpcHandlers(rpc)
  }

  private async handleHostExit(info: ExtensionHostExitInfo): Promise<void> {
    await this.mutex.runExclusive(async () => {
      this.handshaken = false
      this.options.capabilities?.detachRpc()
      this.options.capabilities?.releaseAll()
      this.options.contributions?.releaseAll()
      this.rpc?.dispose('Extension host exited')
      this.rpc = null
      this.controller = null
      this.loadedExtensions.clear()
      this.runtimeHandles.clear()

      if (info.expected) {
        log.info(`[RuntimeManager] Extension host exited cleanly with code ${info.code}`)
        return
      }

      log.warn(`[RuntimeManager] Extension host exited unexpectedly with code ${info.code}`)

      if (this.desiredExtensions.size === 0) {
        return
      }

      const decision = this.crashPolicy.recordCrash()
      if (!decision.restart) {
        log.error(
          '[RuntimeManager] Extension host crash limit reached; automatic recovery has been disabled'
        )
        return
      }

      await delay(decision.delayMs)
      await this.recoverDesiredExtensionsLocked('crash-recovery')
      log.info('[RuntimeManager] Extension host recovered and desired extensions were reloaded')
    })
  }

  private async restartHostLocked(
    cause: ExtensionRuntimeChangeCause,
    skipExtensionIds = new Set<string>()
  ): Promise<void> {
    await this.stopHostLocked({ clearDesired: false })
    await this.recoverDesiredExtensionsLocked(cause, skipExtensionIds)
  }

  private async recoverDesiredExtensionsLocked(
    cause: ExtensionRuntimeChangeCause,
    skipExtensionIds = new Set<string>()
  ): Promise<void> {
    if (this.desiredExtensions.size === 0) {
      return
    }

    await this.ensureHostReadyLocked()

    for (const extension of this.desiredExtensions.values()) {
      if (skipExtensionIds.has(extension.id)) {
        continue
      }

      try {
        await this.loadIntoHostLocked(extension, cause)
      } catch (error) {
        log.error(`[RuntimeManager] Failed to recover extension "${extension.id}":`, error)
      }
    }
  }

  private async stopHostLocked(options: {
    clearDesired: boolean
    unloadBeforeStop?: boolean
  }): Promise<void> {
    const unloadBeforeStop = options.unloadBeforeStop ?? true
    const controller = this.controller
    const rpc = this.rpc

    if (unloadBeforeStop && rpc && controller?.isRunning()) {
      for (const [extensionId, state] of [...this.loadedExtensions.entries()].reverse()) {
        try {
          const result = await rpc.requestHost(
            'extensions.unload',
            { extensionId, runtimeHandle: state.runtimeHandle, reason: 'shutdown' },
            { timeoutMs: 10_000 }
          )
          logUnloadResult(extensionId, result)
        } catch (error) {
          log.warn(
            `[RuntimeManager] Failed to unload extension "${extensionId}" during shutdown:`,
            error
          )
        }
      }
    }

    this.options.capabilities?.detachRpc()
    this.options.capabilities?.releaseAll()
    this.options.contributions?.releaseAll()
    rpc?.dispose('Extension host stopped')
    this.rpc = null
    this.handshaken = false
    this.loadedExtensions.clear()
    this.runtimeHandles.clear()

    if (controller) {
      await controller.stop()
    }

    this.controller = null

    if (options.clearDesired) {
      this.desiredExtensions.clear()
    }

    this.crashPolicy.reset()
  }

  private async requestHostLifecycle<K extends MainToHostRpcMethod>(
    method: K,
    params: RpcParams<MainToHostRpcRequestMap, K>,
    extensionId: string,
    cause: ExtensionRuntimeChangeCause,
    timeoutMs: number
  ): Promise<RpcResult<MainToHostRpcRequestMap, K>> {
    try {
      return await this.requireRpc().requestHost(method, params, { timeoutMs })
    } catch (error) {
      if (error instanceof RpcTimeoutError) {
        await this.handleLifecycleTimeoutLocked(extensionId, cause, error)
      }

      throw error
    }
  }

  private async handleLifecycleTimeoutLocked(
    extensionId: string,
    cause: ExtensionRuntimeChangeCause,
    error: RpcTimeoutError
  ): Promise<void> {
    log.warn(
      `[RuntimeManager] Lifecycle RPC "${error.method}" for extension "${extensionId}" timed out; restarting host`
    )

    await this.stopHostLocked({ clearDesired: false, unloadBeforeStop: false })
    await this.recoverDesiredExtensionsLocked(
      cause === 'host-timeout' ? cause : 'host-timeout',
      new Set([extensionId])
    )
  }

  private async readStorageDocument(
    runtimeHandle: ExtensionRuntimeHandle
  ): Promise<Record<string, SerializableValue>> {
    const storagePath = this.getStoragePath(this.requireActiveRuntimeHandle(runtimeHandle))
    await fse.ensureDir(path.dirname(storagePath))

    if (!(await fse.pathExists(storagePath))) {
      return {}
    }

    try {
      const raw = await fse.readJson(storagePath)
      return normalizeSerializableRecord(raw)
    } catch (error) {
      log.warn(
        `[RuntimeManager] Failed to read storage for runtime handle "${runtimeHandle}", using empty document:`,
        error
      )
      return {}
    }
  }

  private async writeStorageDocument(
    runtimeHandle: ExtensionRuntimeHandle,
    document: Record<string, SerializableValue>
  ): Promise<void> {
    const storagePath = this.getStoragePath(this.requireActiveRuntimeHandle(runtimeHandle))
    await fse.ensureDir(path.dirname(storagePath))

    const tempPath = `${storagePath}.tmp`
    await fse.writeJson(tempPath, document, { spaces: 2 })
    await fse.move(tempPath, storagePath, { overwrite: true })
  }

  private getStoragePath(extension: ExtensionRuntimeMetadata): string {
    return path.join(extension.dataPath, 'storage.json')
  }

  private requireActiveRuntimeHandle(
    runtimeHandle: ExtensionRuntimeHandle
  ): ExtensionRuntimeMetadata {
    const extension = this.runtimeHandles.get(runtimeHandle)
    if (!extension) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return extension
  }

  private releaseLoadedState(state: LoadedExtensionState): void {
    this.runtimeHandles.delete(state.runtimeHandle)
    this.options.capabilities?.releaseRuntime(state.runtimeHandle)
    this.options.contributions?.releaseRuntime(state.runtimeHandle)
  }

  private nextGeneration(): number {
    this.generationCounter += 1
    return this.generationCounter
  }

  private requireRpc(): ExtensionHostRpcClient {
    if (!this.rpc) {
      throw new Error('Extension host RPC client is not connected')
    }

    return this.rpc
  }
}

function createRuntimeInfo(): RuntimeInfo {
  return {
    appVersion: app.getVersion(),
    apiVersion: EXTENSION_API_VERSION,
    mode: app.isPackaged ? 'production' : 'development',
    platform: toRuntimePlatform(process.platform),
    arch: process.arch
  }
}

function writeExtensionLog(
  extensionId: string,
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  args: readonly RpcValue[]
): void {
  const prefix = `[ExtensionHost][${extensionId}] ${message}`

  switch (level) {
    case 'debug':
      log.debug(prefix, ...args)
      break
    case 'info':
      log.info(prefix, ...args)
      break
    case 'warn':
      log.warn(prefix, ...args)
      break
    case 'error':
      log.error(prefix, ...args)
      break
  }
}

function logUnloadResult(extensionId: string, result: ExtensionUnloadResult): void {
  if (!result.unloaded) {
    return
  }

  if (result.deactivateError) {
    log.warn(
      `[RuntimeManager] Extension "${extensionId}" threw during deactivate: ${result.deactivateError.message}`
    )
  }

  if (result.cleanupError) {
    log.warn(
      `[RuntimeManager] Extension "${extensionId}" threw during cleanup: ${result.cleanupError.message}`
    )
  }
}

function mapLoadedMetadata(
  loadedExtensions: ReadonlyMap<string, LoadedExtensionState>
): ReadonlyMap<string, ExtensionRuntimeMetadata> {
  const result = new Map<string, ExtensionRuntimeMetadata>()
  for (const [extensionId, state] of loadedExtensions) {
    result.set(extensionId, state.metadata)
  }
  return result
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
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
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

function toChangeCause(reason: ExtensionUnloadReason): ExtensionRuntimeChangeCause {
  switch (reason) {
    case 'disable':
      return 'disable'
    case 'update':
      return 'package-update'
    case 'reload':
      return 'user'
    case 'shutdown':
      return 'user'
  }
}

function toRuntimePlatform(platform: NodeJS.Platform): RuntimeInfo['platform'] {
  switch (platform) {
    case 'darwin':
      return 'macos'
    case 'win32':
      return 'windows'
    default:
      return 'linux'
  }
}

function isSameRuntimeMetadata(
  left: ExtensionRuntimeMetadata,
  right: ExtensionRuntimeMetadata
): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.version === right.version &&
    left.manifestPath === right.manifestPath &&
    left.extensionPath === right.extensionPath &&
    left.dataPath === right.dataPath &&
    left.tempPath === right.tempPath &&
    left.mode === right.mode
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
