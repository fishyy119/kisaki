import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import fse from 'fs-extra'
import { Mutex } from 'async-mutex'
import { createLogger } from '@main/log'
import type { ExtensionHostInspectOptions } from '@shared/bootstrap'
import {
  EXTENSION_API_VERSION,
  EXTENSION_RPC_PROTOCOL_VERSION,
  RpcTimeoutError,
  type ExtensionRuntimeChangeCause,
  type ExtensionRuntimeDiagnostic,
  type ExtensionRuntimeHandle,
  type ExtensionRuntimeMetadata,
  type ExtensionUnloadReason,
  type ExtensionUnloadResult,
  type MainToHostRpcMethod,
  type MainToHostRpcRequestMap,
  type RpcParams,
  type RpcResult,
  type RuntimeInfo
} from '@kisaki/extension-api'
import { ExtensionHostCrashPolicy } from './crash-policy'
import { delay, toRuntimeErrorMessage } from './errors'
import { registerHostRequests } from './host-request'
import { ExtensionHostController, type ExtensionHostExitInfo } from './host-controller'
import { ExtensionHostRpcClient } from './rpc-client'
import { ExtensionRuntimeLogs } from './logs'
import type { RpcRequestOptions } from './rpc-core'
import { ExtensionRuntimeSecrets } from './secrets'
import {
  createRuntimeFailureState,
  createRuntimeRunningState,
  createRuntimeStoppedState,
  appendRuntimeDiagnostic,
  isSameRuntimeMetadata,
  mapLoadedMetadata,
  toChangeCause,
  type ExtensionRuntimeState,
  type LoadedExtensionState
} from './state'
import { ExtensionRuntimeStorage } from './storage'
import type { ExtensionCapabilityGateway } from '../capabilities'
import type { ExtensionContributionRegistry } from '../contributions'

const log = createLogger('Extension')

export type { ExtensionRuntimeChangeCause } from '@kisaki/extension-api'
export type { ExtensionRuntimeState, ExtensionRuntimeStatus } from './state'

export interface RuntimeManagerOptions {
  hostModulePath: string
  hostInspect?: ExtensionHostInspectOptions
  capabilities?: ExtensionCapabilityGateway
  contributions?: ExtensionContributionRegistry
  onRuntimeStateChanged?(extensionId: string, state: ExtensionRuntimeState): void
}

export interface RuntimeReconcileOptions {
  cause?: ExtensionRuntimeChangeCause
  forceReloadIds?: Iterable<string>
}

export interface RuntimeReloadOptions {
  cause?: ExtensionRuntimeChangeCause
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
  private readonly runtimeStates = new Map<string, ExtensionRuntimeState>()
  private readonly logs = new ExtensionRuntimeLogs(
    (runtimeHandle) => this.runtimeHandles.get(runtimeHandle) ?? null
  )
  private readonly storage = new ExtensionRuntimeStorage(
    (runtimeHandle) => this.runtimeHandles.get(runtimeHandle) ?? null
  )
  private readonly secrets = new ExtensionRuntimeSecrets(
    (runtimeHandle) => this.runtimeHandles.get(runtimeHandle) ?? null
  )
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

  getRuntimeState(extensionId: string): ExtensionRuntimeState | null {
    return this.runtimeStates.get(extensionId) ?? null
  }

  getRuntimeStates(): ReadonlyMap<string, ExtensionRuntimeState> {
    return new Map(this.runtimeStates)
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

      for (const extensionId of [...this.runtimeStates.keys()]) {
        if (!this.desiredExtensions.has(extensionId)) {
          this.recordRuntimeStopped(extensionId)
        }
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

    if (this.shouldRecycleHostLocked(forceReloadIds)) {
      await this.recycleHostLocked(cause)
      return
    }

    try {
      await this.ensureHostReadyLocked()
    } catch (error) {
      this.recordHostStartupFailure(error)
      return
    }

    for (const [extensionId, metadata] of this.desiredExtensions) {
      const loaded = this.loadedExtensions.get(extensionId)

      if (!loaded) {
        try {
          await this.loadIntoHostLocked(metadata, cause)
        } catch (error) {
          log.error('Failed to load extension.', error, { extensionId: extensionId })
        }
        continue
      }

      if (forceReloadIds.has(extensionId) || !isSameRuntimeMetadata(loaded.metadata, metadata)) {
        await this.recycleHostLocked(cause)
        return
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
    this.setRuntimeState(extension.id, createRuntimeRunningState())

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
      await this.options.contributions?.releaseRuntime(runtimeHandle)
      this.recordRuntimeFailure(extension.id, toRuntimeErrorMessage(error))
      throw error
    }

    this.loadedExtensions.set(extension.id, {
      metadata: extension,
      runtimeHandle,
      generation
    })
    this.recordRuntimeRunning(extension.id)
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
    this.recordRuntimeStopped(extensionId)

    if (!this.rpc || !this.controller?.isRunning()) {
      await this.releaseLoadedState(loaded)
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
      log.warn('Failed to unload extension, restarting host to enforce desired state.', error, {
        extensionId: extensionId
      })

      if (!(error instanceof RpcTimeoutError)) {
        await this.restartHostLocked('host-timeout', new Set([extensionId]))
      }
    } finally {
      await this.releaseLoadedState(loaded)
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

    const controller = new ExtensionHostController(
      this.options.hostModulePath,
      this.options.hostInspect
    )
    const rpc = new ExtensionHostRpcClient((message) => controller.send(message))
    registerHostRequests({
      rpc,
      logs: this.logs,
      storage: this.storage,
      secrets: this.secrets,
      capabilities: this.options.capabilities,
      contributions: this.options.contributions,
      resolveRuntimeHandle: (runtimeHandle) => this.runtimeHandles.get(runtimeHandle) ?? null,
      reportDiagnostic: (runtimeHandle, diagnostic) =>
        this.recordRuntimeDiagnostic(runtimeHandle, diagnostic)
    })

    await controller.start((message) => rpc.onMessage(message))
    controller.onExit((info) => {
      void this.handleHostExit(controller, info).catch((error) => {
        log.error('Failed to process extension host exit:', error)
      })
    })

    this.controller = controller
    this.rpc = rpc
    this.handshaken = false
    log.info('Extension host started')
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
    log.info('Extension host handshake completed')
  }

  private async handleHostExit(
    controller: ExtensionHostController,
    info: ExtensionHostExitInfo
  ): Promise<void> {
    await this.mutex.runExclusive(async () => {
      if (this.controller !== controller) {
        log.info('Ignoring stale extension host exit.', { infoCode: info.code })
        return
      }

      this.handshaken = false
      this.options.capabilities?.detachRpc()
      this.options.capabilities?.releaseAll()
      await this.options.contributions?.releaseAll()
      this.rpc?.dispose('Extension host exited')
      this.rpc = null
      this.controller = null
      this.loadedExtensions.clear()
      this.runtimeHandles.clear()
      this.storage.clear()
      this.secrets.clear()

      if (info.expected) {
        log.info('Extension host exited cleanly with code.', { infoCode: info.code })
        return
      }

      log.warn('Extension host exited unexpectedly with code.', { infoCode: info.code })

      if (this.desiredExtensions.size === 0) {
        return
      }

      const decision = this.crashPolicy.recordCrash()
      if (!decision.restart) {
        log.error('Extension host crash limit reached; automatic recovery has been disabled')
        for (const extensionId of this.desiredExtensions.keys()) {
          this.recordRuntimeFailure(extensionId, 'Extension host crashed repeatedly.')
        }
        return
      }

      await delay(decision.delayMs)
      await this.recoverDesiredExtensionsLocked('crash-recovery')
      log.info('Extension host recovered and desired extensions were reloaded')
    })
  }

  private async restartHostLocked(
    cause: ExtensionRuntimeChangeCause,
    skipExtensionIds = new Set<string>()
  ): Promise<void> {
    await this.stopHostLocked({ clearDesired: false })
    await this.recoverDesiredExtensionsLocked(cause, skipExtensionIds)
  }

  private async recycleHostLocked(cause: ExtensionRuntimeChangeCause): Promise<void> {
    log.info('Recycling extension host.', { cause: cause })
    await this.stopHostLocked({
      clearDesired: false,
      unloadReason: toRecycleUnloadReason(cause)
    })

    try {
      await this.recoverDesiredExtensionsLocked(cause)
    } catch (error) {
      this.recordHostStartupFailure(error)
    }
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
        log.error('Failed to recover extension.', error, { extensionId: extension.id })
      }
    }
  }

  private async stopHostLocked(options: {
    clearDesired: boolean
    unloadBeforeStop?: boolean
    unloadReason?: ExtensionUnloadReason
  }): Promise<void> {
    const unloadBeforeStop = options.unloadBeforeStop ?? true
    const unloadReason = options.unloadReason ?? 'shutdown'
    const controller = this.controller
    const rpc = this.rpc

    if (unloadBeforeStop && rpc && controller?.isRunning()) {
      for (const [extensionId, state] of [...this.loadedExtensions.entries()].reverse()) {
        try {
          const result = await rpc.requestHost(
            'extensions.unload',
            { extensionId, runtimeHandle: state.runtimeHandle, reason: unloadReason },
            { timeoutMs: 10_000 }
          )
          logUnloadResult(extensionId, result)
        } catch (error) {
          log.warn('Failed to unload extension during shutdown.', error, {
            extensionId: extensionId
          })
        }
      }
    }

    this.options.capabilities?.detachRpc()
    this.options.capabilities?.releaseAll()
    await this.options.contributions?.releaseAll()
    rpc?.dispose('Extension host stopped')
    this.rpc = null
    this.handshaken = false
    this.loadedExtensions.clear()
    this.runtimeHandles.clear()
    this.storage.clear()
    this.secrets.clear()

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
    log.warn('Lifecycle RPC timed out; restarting host.', {
      errorMethod: error.method,
      extensionId: extensionId
    })

    await this.stopHostLocked({ clearDesired: false, unloadBeforeStop: false })
    await this.recoverDesiredExtensionsLocked(
      cause === 'host-timeout' ? cause : 'host-timeout',
      new Set([extensionId])
    )
  }

  private async releaseLoadedState(state: LoadedExtensionState): Promise<void> {
    this.runtimeHandles.delete(state.runtimeHandle)
    this.options.capabilities?.releaseRuntime(state.runtimeHandle)
    await this.options.contributions?.releaseRuntime(state.runtimeHandle)
  }

  private nextGeneration(): number {
    this.generationCounter += 1
    return this.generationCounter
  }

  private shouldRecycleHostLocked(forceReloadIds: ReadonlySet<string>): boolean {
    if (!this.controller?.isRunning() || this.loadedExtensions.size === 0) {
      return false
    }

    for (const extensionId of forceReloadIds) {
      if (this.desiredExtensions.has(extensionId)) {
        return true
      }
    }

    for (const [extensionId, metadata] of this.desiredExtensions) {
      const loaded = this.loadedExtensions.get(extensionId)
      if (loaded && !isSameRuntimeMetadata(loaded.metadata, metadata)) {
        return true
      }
    }

    return false
  }

  private requireRpc(): ExtensionHostRpcClient {
    if (!this.rpc) {
      throw new Error('Extension host RPC client is not connected')
    }

    return this.rpc
  }

  private recordRuntimeRunning(extensionId: string): void {
    this.setRuntimeState(
      extensionId,
      createRuntimeRunningState(this.runtimeStates.get(extensionId)?.diagnostics ?? [])
    )
  }

  private recordRuntimeFailure(extensionId: string, error: string): void {
    this.setRuntimeState(extensionId, createRuntimeFailureState(error))
  }

  private recordHostStartupFailure(error: unknown): void {
    const message = toRuntimeErrorMessage(error)
    log.error('Failed to start extension host:', error)

    for (const extension of this.desiredExtensions.values()) {
      if (!this.loadedExtensions.has(extension.id)) {
        this.recordRuntimeFailure(extension.id, message)
      }
    }
  }

  private recordRuntimeStopped(extensionId: string): void {
    this.setRuntimeState(extensionId, createRuntimeStoppedState())
  }

  private recordRuntimeDiagnostic(
    runtimeHandle: ExtensionRuntimeHandle,
    diagnostic: ExtensionRuntimeDiagnostic
  ): void {
    const extension = this.runtimeHandles.get(runtimeHandle)
    if (!extension) {
      log.warn('Ignoring diagnostic for inactive runtime handle.', { runtimeHandle: runtimeHandle })
      return
    }

    const current = this.runtimeStates.get(extension.id) ?? createRuntimeRunningState()
    this.setRuntimeState(extension.id, appendRuntimeDiagnostic(current, diagnostic))
  }

  private setRuntimeState(extensionId: string, state: ExtensionRuntimeState): void {
    this.runtimeStates.set(extensionId, state)
    this.options.onRuntimeStateChanged?.(extensionId, state)
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

function logUnloadResult(extensionId: string, result: ExtensionUnloadResult): void {
  if (!result.unloaded) {
    return
  }

  if (result.deactivateError) {
    log.warn('Extension threw during deactivate.', {
      extensionId: extensionId,
      resultDeactivateErrorMessage: result.deactivateError.message
    })
  }

  if (result.cleanupError) {
    log.warn('Extension threw during cleanup.', {
      extensionId: extensionId,
      resultCleanupErrorMessage: result.cleanupError.message
    })
  }
}

function toRecycleUnloadReason(cause: ExtensionRuntimeChangeCause): ExtensionUnloadReason {
  switch (cause) {
    case 'package-update':
      return 'update'
    case 'file-change':
    case 'metadata-change':
    case 'user':
      return 'reload'
    default:
      return 'shutdown'
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
