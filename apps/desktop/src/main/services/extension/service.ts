import path from 'node:path'
import { app } from 'electron'
import log from 'electron-log/main'
import { Mutex } from 'async-mutex'
import type { ExtensionRuntimeMetadata } from '@kisaki/extension-api'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { IpcService } from '@main/services/ipc'
import type { EventService } from '@main/services/event'
import type {
  ExtensionContributionSnapshot,
  ExtensionEntityMenuInvokeRequest,
  ExtensionEntityMenuInvokeResult,
  ExtensionResolvedEntityMenu,
  ExtensionResolvedSettingsPanel,
  ExtensionSettingsPanelCallbackResult,
  ExtensionSettingsPanelInfo,
  ExtensionSettingsPanelInvokeRequest,
  ExtensionSettingsPanelSubmitRequest,
  ExtensionThemeContributionInfo
} from '@shared/extension'
import type { EntityMenuResolveInput } from '@kisaki/extension-api'
import type {
  ExtensionCatalogEntry,
  ExtensionSearchOptions,
  ExtensionSearchResult,
  ExtensionSourceProviderInfo,
  ExtensionUpdateInfo,
  ExtensionServicePaths
} from './types'
import { createExtensionRuntimeMetadata } from './types'
import { ExtensionCatalog } from './catalog'
import { ExtensionInstaller } from './installer'
import { registerExtensionIpc } from './ipc'
import { ExtensionReloadWatcher } from './reload-watcher'
import {
  buildDesiredRuntimeMap,
  resolveDevExtension,
  syncReloadWatcherTargets
} from './runtime-sync'
import { ExtensionStateStore } from './state'
import {
  RuntimeManager,
  type ExtensionRuntimeChangeCause,
  type ExtensionRuntimeState
} from './runtime/manager'
import { GitHubExtensionSourceProvider } from './sources/github'
import { LocalFileExtensionSourceProvider } from './sources/local-file'
import { UrlExtensionSourceProvider } from './sources/url'
import { ExtensionSourceManager } from './sources/manager'
import { ExtensionCapabilityGateway } from './capabilities'
import { ExtensionContributionRegistry } from './contributions/registry'

/**
 * Main-process entry point for the extension system.
 */
export class ExtensionService implements IService {
  readonly id = 'extension'
  readonly deps = [
    'ipc',
    'network',
    'db',
    'event',
    'notify',
    'scraper',
    'deeplink'
  ] as const satisfies readonly ServiceName[]

  readonly sources = new ExtensionSourceManager()

  private stateStore!: ExtensionStateStore
  private catalog!: ExtensionCatalog
  private installer!: ExtensionInstaller
  private paths!: ExtensionServicePaths
  private ipc!: IpcService
  private event!: EventService
  private runtime!: RuntimeManager
  private reloadWatcher!: ExtensionReloadWatcher
  private capabilities!: ExtensionCapabilityGateway
  private contributions!: ExtensionContributionRegistry
  private snapshot: readonly ExtensionCatalogEntry[] = []
  private byId = new Map<string, ExtensionCatalogEntry>()
  private devExtension: ExtensionRuntimeMetadata | null = null
  private contributionSnapshotEmitQueued = false
  private readonly operationMutex = new Mutex()

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const rootDir = path.join(app.getPath('userData'), 'extensions')
    this.paths = {
      rootDir,
      packagesDir: path.join(rootDir, 'packages'),
      dataDir: path.join(rootDir, 'data'),
      tempDir: path.join(rootDir, 'temp'),
      statePath: path.join(rootDir, 'state.json')
    }

    this.stateStore = new ExtensionStateStore(this.paths.statePath)
    await this.stateStore.init()
    this.ipc = container.get('ipc')
    this.event = container.get('event')

    this.sources.register(new GitHubExtensionSourceProvider(container.get('network')))
    this.sources.register(new UrlExtensionSourceProvider(container.get('network')))
    this.sources.register(new LocalFileExtensionSourceProvider())

    this.catalog = new ExtensionCatalog(this.paths, this.stateStore)
    this.installer = new ExtensionInstaller(this.paths, this.stateStore, this.sources)
    this.capabilities = new ExtensionCapabilityGateway({
      db: container.get('db'),
      event: container.get('event'),
      network: container.get('network'),
      notify: container.get('notify'),
      resolveRuntimeHandle: (runtimeHandle) => this.runtime?.resolveRuntimeHandle(runtimeHandle)
    })
    this.contributions = new ExtensionContributionRegistry({
      scraper: container.get('scraper'),
      deeplink: container.get('deeplink'),
      onDidChange: () => this.emitContributionSnapshotChanged(),
      resolveRuntimeHandle: (runtimeHandle) =>
        this.runtime?.resolveRuntimeHandle(runtimeHandle) ?? null,
      requestHost: (method, params, options) => this.runtime.requestHost(method, params, options)
    })
    this.runtime = new RuntimeManager({
      hostModulePath: path.join(app.getAppPath(), 'out', 'main', 'extension-host.js'),
      capabilities: this.capabilities,
      contributions: this.contributions
    })
    this.reloadWatcher = new ExtensionReloadWatcher((extensionId) =>
      this.runMutatingOperation(() => this.reloadExtensionRuntime(extensionId, 'file-change'))
    )
    registerExtensionIpc(this, this.ipc)

    await this.refreshCatalog()
    this.devExtension = await resolveDevExtension(this.paths)
    await this.applyRuntimeState({ cause: 'startup' })
    log.info('[ExtensionService] Initialized')
  }

  getPaths(): ExtensionServicePaths {
    return this.paths
  }

  async refreshCatalog(): Promise<readonly ExtensionCatalogEntry[]> {
    this.snapshot = await this.catalog.refresh()
    this.byId = new Map()

    for (const entry of this.snapshot) {
      if (!this.byId.has(entry.id)) {
        this.byId.set(entry.id, entry)
      }
    }

    return this.snapshot
  }

  getCatalog(): readonly ExtensionCatalogEntry[] {
    return this.snapshot
  }

  getExtension(extensionId: string): ExtensionCatalogEntry | undefined {
    return this.byId.get(extensionId)
  }

  async install(source: string): Promise<ExtensionCatalogEntry> {
    return this.runMutatingOperation(async () => {
      const result = await this.installer.install(source)
      try {
        await this.refreshCatalog()
        await this.applyRuntimeState({ cause: 'install' })
        this.assertRuntimeReady(result.extensionId, 'install')
        await result.commit?.()
        return this.requireCatalogEntry(result.extensionId)
      } catch (error) {
        await this.rollbackInstallResult(result, 'install')
        throw error
      }
    })
  }

  async installFromFile(filePath: string): Promise<ExtensionCatalogEntry> {
    return this.runMutatingOperation(async () => {
      const result = await this.installer.installFromFile(filePath)
      try {
        await this.refreshCatalog()
        await this.applyRuntimeState({ cause: 'install' })
        this.assertRuntimeReady(result.extensionId, 'install')
        await result.commit?.()
        return this.requireCatalogEntry(result.extensionId)
      } catch (error) {
        await this.rollbackInstallResult(result, 'install')
        throw error
      }
    })
  }

  async uninstall(extensionId: string): Promise<void> {
    await this.runMutatingOperation(async () => {
      await this.runtime.unloadExtension(extensionId, 'disable')
      await syncReloadWatcherTargets(this.reloadWatcher, this.runtime.getDesiredExtensions())
      await this.installer.uninstall(extensionId)
      await this.refreshCatalog()
      await this.applyRuntimeState({ cause: 'uninstall' })
    })
  }

  async update(extensionId: string): Promise<ExtensionCatalogEntry | null> {
    return this.runMutatingOperation(async () => {
      await this.runtime.unloadExtension(extensionId, 'update')
      await syncReloadWatcherTargets(this.reloadWatcher, this.runtime.getDesiredExtensions())

      let result: Awaited<ReturnType<ExtensionInstaller['update']>>
      try {
        result = await this.installer.update(extensionId)
      } catch (error) {
        await this.refreshCatalog()
        await this.applyRuntimeState({
          cause: 'package-update',
          forceReloadIds: [extensionId]
        })
        throw error
      }

      await this.refreshCatalog()
      try {
        await this.applyRuntimeState({
          cause: 'package-update',
          forceReloadIds: result ? [result.extensionId] : [extensionId]
        })
        if (result) {
          this.assertRuntimeReadyIfDesired(result.extensionId, 'update')
        } else {
          this.assertRuntimeReadyIfDesired(extensionId, 'update')
        }
      } catch (error) {
        if (result) {
          await result.rollback?.()
          await this.refreshCatalog()
          await this.applyRuntimeState({
            cause: 'package-update',
            forceReloadIds: [extensionId]
          })
        }
        throw error
      }

      if (!result) {
        return null
      }

      await result.commit?.()
      return this.requireCatalogEntry(result.extensionId)
    })
  }

  async checkUpdates(): Promise<readonly ExtensionUpdateInfo[]> {
    return this.installer.checkUpdates()
  }

  async enable(extensionId: string): Promise<ExtensionCatalogEntry> {
    return this.runMutatingOperation(async () => {
      await this.stateStore.setEnabled(extensionId, true)
      try {
        await this.refreshCatalog()
        await this.applyRuntimeState({ cause: 'enable' })
        this.assertRuntimeReady(extensionId, 'enable')
      } catch (error) {
        await this.stateStore.setEnabled(extensionId, false)
        await this.refreshCatalog()
        await this.applyRuntimeState({ cause: 'disable' })
        throw error
      }
      this.event.emit('extension:enabled', { extensionId })
      return this.requireCatalogEntry(extensionId)
    })
  }

  async disable(extensionId: string): Promise<ExtensionCatalogEntry> {
    return this.runMutatingOperation(async () => {
      await this.stateStore.setEnabled(extensionId, false)
      await this.refreshCatalog()
      await this.applyRuntimeState({ cause: 'disable' })
      this.event.emit('extension:disabled', { extensionId })
      return this.requireCatalogEntry(extensionId)
    })
  }

  async isEnabled(extensionId: string): Promise<boolean> {
    const record = await this.stateStore.get(extensionId)
    if (!record) {
      throw new Error(`Extension "${extensionId}" is not installed`)
    }

    return record.enabled
  }

  getSearchableSources(): readonly ExtensionSourceProviderInfo[] {
    return this.sources.getSearchableProviders()
  }

  searchSource(
    providerName: string,
    query: string,
    options?: ExtensionSearchOptions
  ): Promise<ExtensionSearchResult> {
    return this.sources.search(providerName, query, options)
  }

  createRuntimeMetadata(extensionId: string) {
    const entry = this.requireCatalogEntry(extensionId)
    return createExtensionRuntimeMetadata(entry)
  }

  getRuntimeState(extensionId: string): ExtensionRuntimeState | null {
    return this.runtime.getRuntimeState(extensionId)
  }

  async reload(extensionId: string): Promise<ExtensionCatalogEntry> {
    return this.runMutatingOperation(async () => {
      await this.reloadExtensionRuntime(extensionId, 'user')
      this.assertRuntimeReady(extensionId, 'reload')
      return this.requireCatalogEntry(extensionId)
    })
  }

  getContributionSnapshot(): ExtensionContributionSnapshot {
    return this.contributions.getSnapshot()
  }

  getSettingsPanels(): readonly ExtensionSettingsPanelInfo[] {
    return this.contributions.settingsPanels.getSnapshot()
  }

  getThemeContributions(): readonly ExtensionThemeContributionInfo[] {
    return this.contributions.themes.getSnapshot()
  }

  resolveEntityMenu(input: EntityMenuResolveInput): Promise<ExtensionResolvedEntityMenu> {
    return this.contributions.entityMenus.resolve(input)
  }

  invokeEntityMenuCallback(
    request: ExtensionEntityMenuInvokeRequest
  ): Promise<ExtensionEntityMenuInvokeResult> {
    return this.contributions.entityMenus.invoke(request)
  }

  releaseEntityMenuSession(sessionId: string): Promise<void> {
    return this.contributions.entityMenus.releaseSession(sessionId)
  }

  resolveSettingsPanel(
    extensionId: string,
    panelId: string
  ): Promise<ExtensionResolvedSettingsPanel> {
    return this.contributions.settingsPanels.resolve(extensionId, panelId)
  }

  submitSettingsPanel(
    request: ExtensionSettingsPanelSubmitRequest
  ): Promise<ExtensionSettingsPanelCallbackResult> {
    return this.contributions.settingsPanels.submit(request)
  }

  invokeSettingsPanelCallback(
    request: ExtensionSettingsPanelInvokeRequest
  ): Promise<ExtensionSettingsPanelCallbackResult> {
    return this.contributions.settingsPanels.invoke(request)
  }

  releaseSettingsPanelSession(
    extensionId: string,
    panelId: string,
    sessionId: string
  ): Promise<void> {
    return this.contributions.settingsPanels.releaseSession(extensionId, panelId, sessionId)
  }

  async dispose(): Promise<void> {
    await this.reloadWatcher.stop()
    await this.runtime.shutdownHost()
  }

  private requireCatalogEntry(extensionId: string): ExtensionCatalogEntry {
    const entry = this.byId.get(extensionId)
    if (!entry) {
      throw new Error(`Extension "${extensionId}" is not present in the catalog`)
    }

    return entry
  }

  private runMutatingOperation<T>(operation: () => Promise<T>): Promise<T> {
    return this.operationMutex.runExclusive(operation)
  }

  private async reloadExtensionRuntime(
    extensionId: string,
    cause: ExtensionRuntimeChangeCause
  ): Promise<void> {
    await this.refreshCatalog()
    this.devExtension = await resolveDevExtension(this.paths)
    await this.applyRuntimeState({
      cause,
      forceReloadIds: [extensionId]
    })
  }

  private async applyRuntimeState(options: {
    cause: ExtensionRuntimeChangeCause
    forceReloadIds?: Iterable<string>
  }): Promise<void> {
    const desired = buildDesiredRuntimeMap(this.snapshot, this.devExtension)
    await this.runtime.reconcile(desired, options)
    await syncReloadWatcherTargets(this.reloadWatcher, desired)
    this.emitContributionSnapshotChanged()
  }

  private assertRuntimeReady(extensionId: string, operation: string): void {
    if (!this.runtime.getDesiredExtensions().has(extensionId)) {
      throw new Error(
        `Extension ${operation} did not start because "${extensionId}" is not runtime-ready.`
      )
    }

    this.assertRuntimeReadyIfDesired(extensionId, operation)
  }

  private assertRuntimeReadyIfDesired(extensionId: string, operation: string): void {
    if (!this.runtime.getDesiredExtensions().has(extensionId)) {
      return
    }

    const runtimeState = this.runtime.getRuntimeState(extensionId)
    if (runtimeState?.status === 'running') {
      return
    }

    if (runtimeState?.status === 'failed') {
      throw new Error(
        `Extension ${operation} failed to load: ${runtimeState.error ?? 'Unknown runtime error'}`
      )
    }

    throw new Error(
      `Extension ${operation} did not reach the running state; current runtime status is "${
        runtimeState?.status ?? 'missing'
      }".`
    )
  }

  private async rollbackInstallResult(
    result: Awaited<ReturnType<ExtensionInstaller['install']>>,
    cause: ExtensionRuntimeChangeCause
  ): Promise<void> {
    try {
      await result.rollback?.()
      await this.refreshCatalog()
      await this.applyRuntimeState({ cause })
    } catch (rollbackError) {
      log.error(
        `[ExtensionService] Failed to roll back extension install "${result.extensionId}":`,
        rollbackError
      )
    }
  }

  private emitContributionSnapshotChanged(): void {
    if (this.contributionSnapshotEmitQueued) {
      return
    }

    this.contributionSnapshotEmitQueued = true
    queueMicrotask(() => {
      this.contributionSnapshotEmitQueued = false
      this.ipc.send('extension:contributions-changed', this.getContributionSnapshot())
    })
  }
}
