import path from 'node:path'
import { app } from 'electron'
import fse from 'fs-extra'
import log from 'electron-log/main'
import type { ExtensionRuntimeMetadata } from '@kisaki/extension-api'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import { getBootstrapArgs } from '@main/bootstrap/args'
import type { IpcService } from '@main/services/ipc'
import type {
  ExtensionCatalogInfo,
  ExtensionRegistryEntry,
  ExtensionUpdateInfo as SharedExtensionUpdateInfo
} from '@shared/extension'
import type {
  ExtensionCatalogEntry,
  ExtensionSearchOptions,
  ExtensionSearchResult,
  ExtensionSourceEntry,
  ExtensionSourceProviderInfo,
  ExtensionUpdateInfo,
  ExtensionServicePaths
} from './types'
import { createExtensionRuntimeMetadata } from './types'
import { ExtensionCatalog } from './catalog'
import { ExtensionInstaller } from './installer'
import { readExtensionManifestFile, validateInstalledExtensionPackage } from './manifest'
import { ExtensionReloadWatcher } from './reload-watcher'
import { ExtensionStateStore } from './state'
import { RuntimeManager, type ExtensionRuntimeChangeCause } from './runtime/manager'
import { GitHubExtensionSourceProvider } from './sources/github'
import { LocalFileExtensionSourceProvider } from './sources/local-file'
import { ExtensionSourceManager } from './sources/manager'
import { ExtensionCapabilityGateway } from './capabilities'

/**
 * Main-process entry point for the new extension system's phase 2A infrastructure.
 */
export class ExtensionService implements IService {
  readonly id = 'extension'
  readonly deps = [
    'ipc',
    'network',
    'db',
    'event',
    'notify'
  ] as const satisfies readonly ServiceName[]

  readonly sources = new ExtensionSourceManager()

  private stateStore!: ExtensionStateStore
  private catalog!: ExtensionCatalog
  private installer!: ExtensionInstaller
  private paths!: ExtensionServicePaths
  private ipc!: IpcService
  private runtime!: RuntimeManager
  private reloadWatcher!: ExtensionReloadWatcher
  private capabilities!: ExtensionCapabilityGateway
  private snapshot: readonly ExtensionCatalogEntry[] = []
  private byId = new Map<string, ExtensionCatalogEntry>()
  private devExtension: ExtensionRuntimeMetadata | null = null

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

    this.sources.register(new GitHubExtensionSourceProvider(container.get('network')))
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
    this.runtime = new RuntimeManager({
      hostModulePath: path.join(app.getAppPath(), 'out', 'main', 'extension-host.js'),
      capabilities: this.capabilities
    })
    this.reloadWatcher = new ExtensionReloadWatcher((extensionId) =>
      this.reloadExtensionRuntime(extensionId, 'file-change')
    )
    this.setupIpcHandlers()

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
    return this.byId.get(extensionId)
  }

  async install(source: string): Promise<ExtensionCatalogEntry> {
    const result = await this.installer.install(source)
    await this.refreshCatalog()
    await this.applyRuntimeState({ cause: 'install' })
    return this.requireCatalogEntry(result.extensionId)
  }

  async installFromFile(filePath: string): Promise<ExtensionCatalogEntry> {
    const result = await this.installer.installFromFile(filePath)
    await this.refreshCatalog()
    await this.applyRuntimeState({ cause: 'install' })
    return this.requireCatalogEntry(result.extensionId)
  }

  async uninstall(extensionId: string): Promise<void> {
    await this.runtime.unloadExtension(extensionId, 'disable')
    await this.syncReloadWatcherTargets(this.runtime.getDesiredExtensions())
    await this.installer.uninstall(extensionId)
    await this.refreshCatalog()
    await this.applyRuntimeState({ cause: 'uninstall' })
  }

  async update(extensionId: string): Promise<ExtensionCatalogEntry | null> {
    await this.runtime.unloadExtension(extensionId, 'update')
    await this.syncReloadWatcherTargets(this.runtime.getDesiredExtensions())
    const result = await this.installer.update(extensionId)
    await this.refreshCatalog()
    await this.applyRuntimeState({
      cause: 'package-update',
      forceReloadIds: result ? [result.extensionId] : [extensionId]
    })

    if (!result) {
      return null
    }

    return this.requireCatalogEntry(result.extensionId)
  }

  async checkUpdates(): Promise<readonly ExtensionUpdateInfo[]> {
    return this.installer.checkUpdates()
  }

  async enable(extensionId: string): Promise<ExtensionCatalogEntry> {
    await this.stateStore.setEnabled(extensionId, true)
    await this.refreshCatalog()
    await this.applyRuntimeState({ cause: 'enable' })
    this.capabilities.emitHostEvent('extension.enabled', { extensionId })
    return this.requireCatalogEntry(extensionId)
  }

  async disable(extensionId: string): Promise<ExtensionCatalogEntry> {
    await this.stateStore.setEnabled(extensionId, false)
    await this.refreshCatalog()
    await this.applyRuntimeState({ cause: 'disable' })
    this.capabilities.emitHostEvent('extension.disabled', { extensionId })
    return this.requireCatalogEntry(extensionId)
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

  async reload(extensionId: string): Promise<ExtensionCatalogEntry> {
    await this.reloadExtensionRuntime(extensionId, 'user')
    return this.requireCatalogEntry(extensionId)
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

  private setupIpcHandlers(): void {
    this.ipc.handle('extension:disable', async (_, extensionId: string) => {
      try {
        await this.disable(extensionId)
        return { success: true }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    })

    this.ipc.handle('extension:enable', async (_, extensionId: string) => {
      try {
        await this.enable(extensionId)
        return { success: true }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    })

    this.ipc.handle('extension:is-enabled', async (_, extensionId: string) => {
      try {
        return { success: true, data: await this.isEnabled(extensionId) }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    })

    this.ipc.handle('extension:install', async (_, source: string) => {
      try {
        await this.install(source)
        return { success: true }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    })

    this.ipc.handle('extension:install-from-file', async (_, filePath: string) => {
      try {
        await this.installFromFile(filePath)
        return { success: true }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    })

    this.ipc.handle('extension:uninstall', async (_, extensionId: string) => {
      try {
        await this.uninstall(extensionId)
        return { success: true }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    })

    this.ipc.handle('extension:check-updates', async () => {
      try {
        return {
          success: true,
          data: (await this.checkUpdates()).map(toSharedExtensionUpdateInfo)
        }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    })

    this.ipc.handle('extension:update', async (_, extensionId: string) => {
      try {
        await this.update(extensionId)
        return { success: true }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    })

    this.ipc.handle('extension:reload', async (_, extensionId: string) => {
      try {
        await this.reload(extensionId)
        return { success: true }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    })

    this.ipc.handle('extension:get-catalog', async () => {
      try {
        await this.refreshCatalog()
        return {
          success: true,
          data: this.getCatalog().map(toExtensionCatalogInfo)
        }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    })

    this.ipc.handle('extension:get-sources', () => {
      try {
        return {
          success: true,
          data: [...this.getSearchableSources()]
        }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    })

    this.ipc.handle(
      'extension:search',
      async (
        _,
        sourceName: string,
        query: string,
        options?: { page?: number; limit?: number; sortBy?: 'stars' | 'updated' | 'name' }
      ) => {
        try {
          const result = await this.searchSource(sourceName, query, options)
          return {
            success: true,
            data: {
              entries: result.entries.map(toExtensionRegistryEntry),
              total: result.total,
              hasMore: result.hasMore
            }
          }
        } catch (error) {
          return { success: false, error: toErrorMessage(error) }
        }
      }
    )
  }

  private async resolveDevExtension(): Promise<ExtensionRuntimeMetadata | null> {
    const devExtensionPath = getBootstrapArgs().devExtension
    if (!devExtensionPath) {
      return null
    }

    const extensionPath = path.resolve(devExtensionPath)
    const manifestPath = path.join(extensionPath, 'manifest.json')

    try {
      const parsed = await readExtensionManifestFile(manifestPath)
      if (!parsed.manifest) {
        throw new Error(parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
      }

      const packageIssues = await validateInstalledExtensionPackage(extensionPath, parsed.manifest)
      if (packageIssues.length > 0) {
        throw new Error(packageIssues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
      }

      const dataPath = path.join(this.paths.dataDir, parsed.manifest.id)
      const tempPath = path.join(this.paths.tempDir, parsed.manifest.id)
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

  private async reloadExtensionRuntime(
    extensionId: string,
    cause: ExtensionRuntimeChangeCause
  ): Promise<void> {
    await this.refreshCatalog()
    this.devExtension = await this.resolveDevExtension()
    await this.applyRuntimeState({
      cause,
      forceReloadIds: [extensionId]
    })
  }

  private async applyRuntimeState(options: {
    cause: ExtensionRuntimeChangeCause
    forceReloadIds?: Iterable<string>
  }): Promise<void> {
    const desired = this.buildDesiredRuntimeMap()
    await this.runtime.reconcile(desired, options)
    await this.syncReloadWatcherTargets(desired)
  }

  private buildDesiredRuntimeMap(): Map<string, ExtensionRuntimeMetadata> {
    const desired = new Map<string, ExtensionRuntimeMetadata>()

    for (const entry of this.snapshot) {
      if (!entry.enabled || entry.status !== 'ready' || !entry.manifest) {
        continue
      }

      desired.set(entry.id, createExtensionRuntimeMetadata(entry))
    }

    if (this.devExtension) {
      desired.set(this.devExtension.id, this.devExtension)
    }

    return desired
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
}

function toExtensionCatalogInfo(entry: ExtensionCatalogEntry): ExtensionCatalogInfo {
  return {
    id: entry.id,
    name: entry.manifest?.name ?? entry.id,
    version: entry.version,
    description: entry.manifest?.description,
    author: entry.manifest?.author,
    homepage: entry.manifest?.homepage,
    categories: entry.categories,
    enabled: entry.enabled,
    status: entry.status,
    source: entry.source,
    directory: entry.packagePath,
    issues: entry.issues
  }
}

function toSharedExtensionUpdateInfo(update: ExtensionUpdateInfo): SharedExtensionUpdateInfo {
  return {
    extensionId: update.extensionId,
    currentVersion: update.currentVersion,
    latestVersion: update.latestVersion,
    source: update.source
  }
}

function toExtensionRegistryEntry(entry: ExtensionSourceEntry): ExtensionRegistryEntry {
  return {
    id: entry.id,
    name: entry.name,
    version: entry.version,
    description: entry.description,
    author: entry.author,
    homepage: entry.homepage,
    categories: entry.categories,
    downloadUrl: entry.downloadUrl,
    provider: entry.provider,
    locator: entry.locator,
    iconUrl: entry.iconUrl,
    stars: entry.stars,
    updatedAt: entry.updatedAt
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown extension service error'
}
