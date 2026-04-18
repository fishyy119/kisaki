import path from 'node:path'
import { app } from 'electron'
import log from 'electron-log/main'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
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
import { ExtensionStateStore } from './state'
import { GitHubExtensionSourceProvider } from './sources/github'
import { LocalFileExtensionSourceProvider } from './sources/local-file'
import { ExtensionSourceManager } from './sources/manager'

/**
 * Main-process entry point for the new extension system's phase 2A infrastructure.
 */
export class ExtensionService implements IService {
  readonly id = 'extension'
  readonly deps = ['ipc', 'network'] as const satisfies readonly ServiceName[]

  readonly sources = new ExtensionSourceManager()

  private stateStore!: ExtensionStateStore
  private catalog!: ExtensionCatalog
  private installer!: ExtensionInstaller
  private paths!: ExtensionServicePaths
  private ipc!: IpcService
  private snapshot: readonly ExtensionCatalogEntry[] = []
  private byId = new Map<string, ExtensionCatalogEntry>()

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
    this.setupIpcHandlers()

    await this.refreshCatalog()
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
    return this.requireCatalogEntry(result.extensionId)
  }

  async installFromFile(filePath: string): Promise<ExtensionCatalogEntry> {
    const result = await this.installer.installFromFile(filePath)
    await this.refreshCatalog()
    return this.requireCatalogEntry(result.extensionId)
  }

  async uninstall(extensionId: string): Promise<void> {
    await this.installer.uninstall(extensionId)
    await this.refreshCatalog()
  }

  async update(extensionId: string): Promise<ExtensionCatalogEntry | null> {
    const result = await this.installer.update(extensionId)
    await this.refreshCatalog()

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
    return this.requireCatalogEntry(extensionId)
  }

  async disable(extensionId: string): Promise<ExtensionCatalogEntry> {
    await this.stateStore.setEnabled(extensionId, false)
    await this.refreshCatalog()
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
