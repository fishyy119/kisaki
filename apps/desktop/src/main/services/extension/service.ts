import path from 'node:path'
import { app } from 'electron'
import fse from 'fs-extra'
import log from 'electron-log/main'
import { Mutex } from 'async-mutex'
import type { ExtensionRuntimeMetadata } from '@kisaki/extension-api'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { IpcService } from '@main/services/ipc'
import type { EventService } from '@main/services/event'
import { getBootstrapArgs } from '@main/bootstrap/args'
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
import { readExtensionManifestFile, validateInstalledExtensionPackage } from './manifest'
import {
  requireSafeExtensionId,
  resolveExtensionIdPath,
  resolveInsideRoot
} from './shared/path-confinement'

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
    const rootDir = resolveInsideRoot(app.getPath('userData'), 'extensions')
    this.paths = {
      rootDir,
      packagesDir: resolveInsideRoot(rootDir, 'packages'),
      builtinPackagesDir: resolveBuiltinExtensionPackagesDir(),
      dataDir: resolveInsideRoot(rootDir, 'data'),
      tempDir: resolveInsideRoot(rootDir, 'temp'),
      statePath: resolveInsideRoot(rootDir, 'state.json')
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
      hostModulePath: resolveInsideRoot(app.getAppPath(), 'out', 'main', 'extension-host.js'),
      capabilities: this.capabilities,
      contributions: this.contributions
    })
    this.reloadWatcher = new ExtensionReloadWatcher((extensionId) =>
      this.runMutatingOperation(() => this.reloadExtensionRuntime(extensionId, 'file-change'))
    )
    registerExtensionIpc(this, this.ipc)

    await this.refreshCatalog()
    this.devExtension = await this.resolveDevExtension()
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
    return this.byId.get(requireSafeExtensionId(extensionId))
  }

  async install(source: string): Promise<ExtensionCatalogEntry> {
    return this.runMutatingOperation(async () => {
      const result = await this.installer.install(source)
      try {
        this.assertNotBuiltinExtensionId(result.extensionId, 'install')
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
        this.assertNotBuiltinExtensionId(result.extensionId, 'install')
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
      const safeExtensionId = requireSafeExtensionId(extensionId)
      this.assertUserManagedExtension(safeExtensionId, 'uninstall')
      await this.requireInstalledCatalogEntry(safeExtensionId)
      await this.runtime.unloadExtension(safeExtensionId, 'disable')
      await this.syncReloadWatcherTargets(this.runtime.getDesiredExtensions())
      await this.installer.uninstall(safeExtensionId)
      await this.refreshCatalog()
      await this.applyRuntimeState({ cause: 'uninstall' })
    })
  }

  async update(extensionId: string): Promise<ExtensionCatalogEntry | null> {
    return this.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(extensionId)
      this.assertUserManagedExtension(safeExtensionId, 'update')
      await this.runtime.unloadExtension(safeExtensionId, 'update')
      await this.syncReloadWatcherTargets(this.runtime.getDesiredExtensions())

      let result: Awaited<ReturnType<ExtensionInstaller['update']>>
      try {
        result = await this.installer.update(safeExtensionId)
      } catch (error) {
        await this.refreshCatalog()
        await this.applyRuntimeState({
          cause: 'package-update',
          forceReloadIds: [safeExtensionId]
        })
        throw error
      }

      await this.refreshCatalog()
      try {
        await this.applyRuntimeState({
          cause: 'package-update',
          forceReloadIds: result ? [result.extensionId] : [safeExtensionId]
        })
        if (result) {
          this.assertRuntimeReadyIfDesired(result.extensionId, 'update')
        } else {
          this.assertRuntimeReadyIfDesired(safeExtensionId, 'update')
        }
      } catch (error) {
        if (result) {
          await result.rollback?.()
          await this.refreshCatalog()
          await this.applyRuntimeState({
            cause: 'package-update',
            forceReloadIds: [safeExtensionId]
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
    const updates = await this.installer.checkUpdates()
    return updates.filter((update) => !this.byId.get(update.extensionId)?.builtin)
  }

  async enable(extensionId: string): Promise<ExtensionCatalogEntry> {
    return this.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(extensionId)
      this.assertUserManagedExtension(safeExtensionId, 'enable')
      await this.stateStore.setEnabled(safeExtensionId, true)
      try {
        await this.refreshCatalog()
        await this.applyRuntimeState({ cause: 'enable' })
        this.assertRuntimeReady(safeExtensionId, 'enable')
      } catch (error) {
        await this.stateStore.setEnabled(safeExtensionId, false)
        await this.refreshCatalog()
        await this.applyRuntimeState({ cause: 'disable' })
        throw error
      }
      this.event.emit('extension:enabled', { extensionId: safeExtensionId })
      return this.requireCatalogEntry(safeExtensionId)
    })
  }

  async disable(extensionId: string): Promise<ExtensionCatalogEntry> {
    return this.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(extensionId)
      this.assertUserManagedExtension(safeExtensionId, 'disable')
      await this.stateStore.setEnabled(safeExtensionId, false)
      await this.refreshCatalog()
      await this.applyRuntimeState({ cause: 'disable' })
      this.event.emit('extension:disabled', { extensionId: safeExtensionId })
      return this.requireCatalogEntry(safeExtensionId)
    })
  }

  async isEnabled(extensionId: string): Promise<boolean> {
    const safeExtensionId = requireSafeExtensionId(extensionId)
    const catalogEntry = this.byId.get(safeExtensionId)
    if (catalogEntry?.builtin) {
      return catalogEntry.enabled
    }

    const record = await this.stateStore.get(safeExtensionId)
    if (!record) {
      throw new Error(`Extension "${safeExtensionId}" is not installed`)
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
    return this.createCatalogRuntimeMetadata(entry)
  }

  getRuntimeState(extensionId: string): ExtensionRuntimeState | null {
    return this.runtime.getRuntimeState(requireSafeExtensionId(extensionId))
  }

  async reload(extensionId: string): Promise<ExtensionCatalogEntry> {
    return this.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(extensionId)
      await this.reloadExtensionRuntime(safeExtensionId, 'user')
      this.assertRuntimeReady(safeExtensionId, 'reload')
      return this.requireCatalogEntry(safeExtensionId)
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
    return this.contributions.entityMenus.invoke({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  releaseEntityMenuSession(sessionId: string): Promise<void> {
    return this.contributions.entityMenus.releaseSession(sessionId)
  }

  resolveSettingsPanel(
    extensionId: string,
    panelId: string
  ): Promise<ExtensionResolvedSettingsPanel> {
    return this.contributions.settingsPanels.resolve(requireSafeExtensionId(extensionId), panelId)
  }

  submitSettingsPanel(
    request: ExtensionSettingsPanelSubmitRequest
  ): Promise<ExtensionSettingsPanelCallbackResult> {
    return this.contributions.settingsPanels.submit({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  invokeSettingsPanelCallback(
    request: ExtensionSettingsPanelInvokeRequest
  ): Promise<ExtensionSettingsPanelCallbackResult> {
    return this.contributions.settingsPanels.invoke({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  releaseSettingsPanelSession(
    extensionId: string,
    panelId: string,
    sessionId: string
  ): Promise<void> {
    return this.contributions.settingsPanels.releaseSession(
      requireSafeExtensionId(extensionId),
      panelId,
      sessionId
    )
  }

  async dispose(): Promise<void> {
    await this.reloadWatcher.stop()
    await this.runtime.shutdownHost()
  }

  private requireCatalogEntry(extensionId: string): ExtensionCatalogEntry {
    const safeExtensionId = requireSafeExtensionId(extensionId)
    const entry = this.byId.get(safeExtensionId)
    if (!entry) {
      throw new Error(`Extension "${safeExtensionId}" is not present in the catalog`)
    }

    return entry
  }

  private async requireInstalledCatalogEntry(extensionId: string): Promise<ExtensionCatalogEntry> {
    const safeExtensionId = requireSafeExtensionId(extensionId)
    const state = await this.stateStore.get(safeExtensionId)
    if (!state) {
      throw new Error(`Extension "${safeExtensionId}" is not installed`)
    }

    await this.refreshCatalog()
    return this.requireCatalogEntry(safeExtensionId)
  }

  private runMutatingOperation<T>(operation: () => Promise<T>): Promise<T> {
    return this.operationMutex.runExclusive(operation)
  }

  private assertUserManagedExtension(extensionId: string, operation: string): void {
    const entry = this.byId.get(requireSafeExtensionId(extensionId))
    if (entry?.builtin) {
      throw new Error(
        `Built-in extension "${extensionId}" is managed by Kisaki and cannot use ${operation}.`
      )
    }
  }

  private assertNotBuiltinExtensionId(extensionId: string, operation: string): void {
    const entry = this.byId.get(requireSafeExtensionId(extensionId))
    if (entry?.builtin) {
      throw new Error(`Cannot ${operation} "${extensionId}" because it is built into Kisaki.`)
    }
  }

  private async reloadExtensionRuntime(
    extensionId: string,
    cause: ExtensionRuntimeChangeCause
  ): Promise<void> {
    const safeExtensionId = requireSafeExtensionId(extensionId)
    await this.refreshCatalog()
    this.devExtension = await this.resolveDevExtension()
    await this.applyRuntimeState({
      cause,
      forceReloadIds: [safeExtensionId]
    })
  }

  private async applyRuntimeState(options: {
    cause: ExtensionRuntimeChangeCause
    forceReloadIds?: Iterable<string>
  }): Promise<void> {
    const desired = this.buildDesiredRuntimeMap()
    await this.runtime.reconcile(desired, options)
    await this.syncReloadWatcherTargets(desired)
    this.emitContributionSnapshotChanged()
  }

  private async resolveDevExtension(): Promise<ExtensionRuntimeMetadata | null> {
    const devExtensionPath = getBootstrapArgs().devExtension
    if (!devExtensionPath) {
      return null
    }

    const extensionPath = path.resolve(devExtensionPath)
    const manifestPath = resolveInsideRoot(extensionPath, 'manifest.json')

    try {
      const parsed = await readExtensionManifestFile(manifestPath)
      if (!parsed.manifest) {
        throw new Error(parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
      }

      const packageIssues = await validateInstalledExtensionPackage(extensionPath, parsed.manifest)
      if (packageIssues.length > 0) {
        throw new Error(packageIssues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
      }

      const dataPath = resolveExtensionIdPath(this.paths.dataDir, parsed.manifest.id)
      const tempPath = resolveExtensionIdPath(this.paths.tempDir, parsed.manifest.id)
      await Promise.all([fse.ensureDir(dataPath), fse.ensureDir(tempPath)])

      log.info(
        `[ExtensionService] Registered dev extension override: ${parsed.manifest.id} -> ${extensionPath}`
      )

      return {
        id: parsed.manifest.id,
        name: parsed.manifest.name,
        version: parsed.manifest.version,
        manifestPath,
        extensionPath,
        dataPath,
        tempPath,
        mode: 'development'
      }
    } catch (error) {
      log.error('[ExtensionService] Failed to load --dev-extension package:', error)
      return null
    }
  }

  private buildDesiredRuntimeMap(): Map<string, ExtensionRuntimeMetadata> {
    const desired = new Map<string, ExtensionRuntimeMetadata>()

    for (const entry of this.snapshot) {
      if (!entry.enabled || entry.status !== 'ready' || !entry.manifest) {
        continue
      }

      desired.set(entry.id, this.createCatalogRuntimeMetadata(entry))
    }

    if (this.devExtension) {
      desired.set(this.devExtension.id, this.devExtension)
    }

    return desired
  }

  private createCatalogRuntimeMetadata(entry: ExtensionCatalogEntry): ExtensionRuntimeMetadata {
    return createExtensionRuntimeMetadata(entry, {
      mode: entry.builtin && !app.isPackaged ? 'development' : 'production'
    })
  }

  private async syncReloadWatcherTargets(
    desired: ReadonlyMap<string, ExtensionRuntimeMetadata> | readonly ExtensionRuntimeMetadata[]
  ): Promise<void> {
    const metadataList = [...desired.values()]

    await this.reloadWatcher.updateTargets(
      metadataList.map((metadata) => ({
        extensionId: metadata.id,
        extensionPath: metadata.extensionPath
      }))
    )
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

function resolveBuiltinExtensionPackagesDir(): string {
  if (app.isPackaged) {
    return resolveInsideRoot(
      path.join(process.resourcesPath, 'app.asar.unpacked', 'resources'),
      'extensions'
    )
  }

  return resolveInsideRoot(app.getAppPath(), 'out', 'extensions')
}
