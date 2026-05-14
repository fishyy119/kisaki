import path from 'node:path'
import { app } from 'electron'
import log from 'electron-log/main'
import { Mutex } from 'async-mutex'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { IpcService } from '@main/services/ipc'
import { ExtensionCapabilityGateway } from './capabilities'
import { ExtensionContributionRegistry } from './contributions'
import {
  ExtensionInstallationManager,
  ExtensionInstallationStore,
  ExtensionInstallationView
} from './installations'
import { ExtensionInstallerManager } from './installer'
import { registerExtensionIpc } from './ipc'
import {
  ExtensionIconManager,
  ExtensionPackageArchiveStore,
  ExtensionPackageDownloader,
  ExtensionPackageExtractor,
  ExtensionPackageLayout,
  ExtensionPackageOperationRegistry,
  ExtensionPackageTransactionCoordinator,
  ExtensionPackageVerifier
} from './packages'
import {
  ExtensionRepositoryFetcher,
  ExtensionRepositoryManager,
  ExtensionRepositoryStore
} from './repositories'
import { ExtensionReloadWatcher } from './reload-watcher'
import { RuntimeManager } from './runtime'
import { ExtensionSignerTrustManager, ExtensionSignerTrustStore } from './signers'
import { ExtensionUpdateManager, ExtensionUpdatePlanner } from './updates'
import type { ExtensionServicePaths } from './types'
import { resolveInsideRoot } from './shared/path-confinement'

/**
 * Main-process composition root for the extension system.
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
    'ingest',
    'command',
    'background-task',
    'deeplink'
  ] as const satisfies readonly ServiceName[]

  capabilities!: ExtensionCapabilityGateway
  contributions!: ExtensionContributionRegistry
  installations!: ExtensionInstallationManager
  installer!: ExtensionInstallerManager
  repositories!: ExtensionRepositoryManager
  runtime!: RuntimeManager
  signers!: ExtensionSignerTrustManager
  updates!: ExtensionUpdateManager

  private paths!: ExtensionServicePaths
  private ipc!: IpcService
  private reloadWatcher!: ExtensionReloadWatcher
  private packageTransactionCoordinator!: ExtensionPackageTransactionCoordinator
  private contributionSnapshotEmitQueued = false
  private readonly operationMutex = new Mutex()
  private readonly packageOperations = new ExtensionPackageOperationRegistry()

  async init(container: ServiceInitContainer<this>): Promise<void> {
    const rootDir = resolveInsideRoot(app.getPath('userData'), 'extensions')
    this.paths = {
      rootDir,
      packagesDir: resolveInsideRoot(rootDir, 'packages'),
      builtinPackagesDir: resolveBuiltinExtensionPackagesDir(),
      dataDir: resolveInsideRoot(rootDir, 'data'),
      tempDir: resolveInsideRoot(rootDir, 'temp')
    }

    const dbService = container.get('db')
    const networkService = container.get('network')
    const layout = new ExtensionPackageLayout(this.paths)
    const packageArchiveStore = new ExtensionPackageArchiveStore(layout)
    const packageVerifier = new ExtensionPackageVerifier()
    this.ipc = container.get('ipc')
    this.packageTransactionCoordinator = new ExtensionPackageTransactionCoordinator(
      layout,
      dbService.db,
      packageArchiveStore
    )

    const installationStore = new ExtensionInstallationStore(dbService.db)
    const packageDownloader = new ExtensionPackageDownloader(layout, networkService)
    const packageExtractor = new ExtensionPackageExtractor(
      layout,
      packageArchiveStore,
      packageVerifier
    )

    await this.recoverPackageTransactions()

    const iconManager = new ExtensionIconManager(rootDir, networkService)
    iconManager.registerProtocolHandler()

    this.signers = new ExtensionSignerTrustManager({
      store: new ExtensionSignerTrustStore(dbService.db),
      runMutatingOperation: (operation) => this.runMutatingOperation(operation),
      onTrustedSignersChanged: () => this.emitTrustedSignersChanged()
    })
    this.repositories = new ExtensionRepositoryManager({
      store: new ExtensionRepositoryStore(dbService.db, {
        allowInsecureLocalUrls: !app.isPackaged
      }),
      fetcher: new ExtensionRepositoryFetcher(networkService, {
        allowInsecureLocalUrls: !app.isPackaged
      }),
      iconManager,
      appVersion: app.getVersion(),
      allowInsecureLocalUrls: !app.isPackaged,
      getInstalledVersions: () => this.installations?.getInstalledVersionMap() ?? new Map(),
      onRepositoriesChanged: () => this.ipc.send('extension:repositories-changed'),
      onCatalogChanged: () => this.ipc.send('extension:catalog-changed')
    })
    await this.repositories.init()

    this.capabilities = new ExtensionCapabilityGateway({
      backgroundTask: container.get('background-task'),
      command: container.get('command'),
      db: container.get('db'),
      event: container.get('event'),
      ingest: container.get('ingest'),
      network: container.get('network'),
      notify: container.get('notify'),
      scraper: container.get('scraper'),
      resolveRuntimeHandle: (runtimeHandle) =>
        this.runtime?.resolveRuntimeHandle(runtimeHandle) ?? null
    })
    this.contributions = new ExtensionContributionRegistry({
      command: container.get('command'),
      scraper: container.get('scraper'),
      deeplink: container.get('deeplink'),
      onDidChange: () => this.emitContributionSnapshotChanged(),
      onEntityMenusRefreshRequested: (event) =>
        this.ipc.send('extension:entity-menus-refresh-requested', event),
      onSettingsPanelsRefreshRequested: (event) =>
        this.ipc.send('extension:settings-panels-refresh-requested', event),
      resolveRuntimeHandle: (runtimeHandle) =>
        this.runtime?.resolveRuntimeHandle(runtimeHandle) ?? null,
      requestHost: (method, params, options) => this.runtime.requestHost(method, params, options)
    })
    this.runtime = new RuntimeManager({
      hostModulePath: resolveInsideRoot(app.getAppPath(), 'out', 'main', 'extension-host.js'),
      capabilities: this.capabilities,
      contributions: this.contributions
    })
    this.reloadWatcher = new ExtensionReloadWatcher(async (extensionId) => {
      await this.installations.reloadRuntime(extensionId, 'file-change')
    })
    this.installations = new ExtensionInstallationManager({
      layout,
      view: new ExtensionInstallationView(layout, installationStore),
      store: installationStore,
      runtime: this.runtime,
      contributions: this.contributions,
      reloadWatcher: this.reloadWatcher,
      packageTransactionCoordinator: this.packageTransactionCoordinator,
      event: container.get('event'),
      runMutatingOperation: (operation) => this.runMutatingOperation(operation),
      onInstallationsChanged: () => this.emitInstallationsChanged(),
      onContributionSnapshotChanged: () => this.emitContributionSnapshotChanged()
    })

    this.installer = new ExtensionInstallerManager({
      layout,
      runtime: this.runtime,
      repositories: this.repositories,
      installations: this.installations,
      signers: this.signers,
      packageDownloader,
      packageExtractor,
      packageVerifier,
      packageTransactionCoordinator: this.packageTransactionCoordinator,
      packageOperations: this.packageOperations,
      runMutatingOperation: (operation) => this.runMutatingOperation(operation),
      onInstallationsChanged: () => this.emitInstallationsChanged(),
      onTrustedSignersChanged: () => this.emitTrustedSignersChanged()
    })
    this.updates = new ExtensionUpdateManager({
      installer: this.installer,
      updatePlanner: new ExtensionUpdatePlanner({
        repositories: this.repositories,
        installations: installationStore,
        createInstallPlan: (candidate) => this.installer.createRepositoryInstallPlan(candidate)
      })
    })

    registerExtensionIpc(this, this.ipc)
    await this.installations.init()
    this.repositories.refreshRepositoriesInBackground()
    log.info('[ExtensionService] Initialized')
  }

  getPaths(): ExtensionServicePaths {
    return this.paths
  }

  async dispose(): Promise<void> {
    await this.reloadWatcher.stop()
    await this.runtime.shutdownHost()
  }

  private runMutatingOperation<T>(operation: () => Promise<T>): Promise<T> {
    return this.operationMutex.runExclusive(operation)
  }

  private emitContributionSnapshotChanged(): void {
    if (this.contributionSnapshotEmitQueued) {
      return
    }

    this.contributionSnapshotEmitQueued = true
    queueMicrotask(() => {
      this.contributionSnapshotEmitQueued = false
      this.ipc.send('extension:contributions-changed', this.contributions.getSnapshot())
    })
  }

  private emitInstallationsChanged(): void {
    this.ipc.send('extension:installations-changed')
    this.ipc.send('extension:catalog-changed')
  }

  private emitTrustedSignersChanged(): void {
    this.ipc.send('extension:trusted-signers-changed')
  }

  private async recoverPackageTransactions(): Promise<void> {
    const recovery = await this.packageTransactionCoordinator.recover()

    for (const action of recovery.actions) {
      log.info('[ExtensionService] Extension package recovery action:', action)
    }

    for (const issue of recovery.issues) {
      log.warn('[ExtensionService] Extension package recovery issue:', issue)
    }
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
