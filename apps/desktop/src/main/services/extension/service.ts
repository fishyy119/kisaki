import path from 'node:path'
import { app } from 'electron'
import { EXTENSION_API_VERSION } from '@kisaki3/extension-api'
import { createLogger } from '@main/log'
import { Mutex } from 'async-mutex'
import { getBootstrapArgs } from '@main/bootstrap/args'
import { bootstrapHooks } from '@main/bootstrap/hooks'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { IpcService } from '@main/services/ipc'
import { ExtensionCapabilityGateway } from './capabilities'
import { ExtensionContributionRegistry } from './contributions'
import { bindExtensionLifecycleHookPoints } from './contributions/hooks'
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
  ExtensionPackageCommitter,
  ExtensionPackageDownloader,
  ExtensionPackageExtractor,
  ExtensionPackageLayout,
  ExtensionPackageRecovery,
  ExtensionPackageVerifier,
  ExtensionUiAssetServer,
  ExtensionWebviewFontServer
} from './packages'
import {
  ExtensionRepositoryFetcher,
  ExtensionRepositoryManager,
  ExtensionRepositoryStore
} from './repositories'
import { ExtensionDevelopmentWatcher } from './development-watcher'
import { RuntimeManager, type ExtensionRuntimeState } from './runtime'
import { ExtensionSignerTrustManager, ExtensionSignerTrustStore } from './signers'
import { ExtensionUpdateManager, ExtensionUpdatePlanner } from './updates'
import { ExtensionWebviewSessionManager } from './webviews'
import type { ExtensionServicePaths } from './types'
import { resolveInsideRoot } from './shared/path-confinement'

const log = createLogger('Extension')

/**
 * Main-process composition root for the extension system.
 */
export class ExtensionService implements IService {
  readonly id = 'extension'
  readonly deps = [
    'ipc',
    'network',
    'db',
    'notify',
    'scraper',
    'ingest',
    'scanner',
    'launcher',
    'monitor',
    'window',
    'command',
    'automation',
    'task-run',
    'deeplink',
    'i18n'
  ] as const satisfies readonly ServiceName[]

  capabilities!: ExtensionCapabilityGateway
  contributions!: ExtensionContributionRegistry
  installations!: ExtensionInstallationManager
  installer!: ExtensionInstallerManager
  repositories!: ExtensionRepositoryManager
  runtime!: RuntimeManager
  signers!: ExtensionSignerTrustManager
  updates!: ExtensionUpdateManager
  webviews!: ExtensionWebviewSessionManager

  private paths!: ExtensionServicePaths
  private ipc!: IpcService
  private developmentWatcher!: ExtensionDevelopmentWatcher
  private packageCommitter!: ExtensionPackageCommitter
  private packageRecovery!: ExtensionPackageRecovery
  private contributionSnapshotEmitQueued = false
  private readonly operationMutex = new Mutex()

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

    const installationStore = new ExtensionInstallationStore(dbService.client)
    this.packageCommitter = new ExtensionPackageCommitter(layout, installationStore)
    this.packageRecovery = new ExtensionPackageRecovery(
      layout,
      packageArchiveStore,
      installationStore
    )
    const packageDownloader = new ExtensionPackageDownloader(layout, networkService)
    const packageExtractor = new ExtensionPackageExtractor(
      layout,
      packageArchiveStore,
      packageVerifier
    )

    await this.recoverPackages()

    const iconManager = new ExtensionIconManager(rootDir, networkService)
    iconManager.registerProtocolHandler()

    const uiAssetServer = new ExtensionUiAssetServer({
      resolveUiSource: (extensionId) =>
        this.installations?.resolveWebviewUiSource(extensionId) ?? null
    })
    uiAssetServer.registerProtocolHandler()

    const webviewFontServer = new ExtensionWebviewFontServer()
    webviewFontServer.registerProtocolHandler()

    this.signers = new ExtensionSignerTrustManager({
      store: new ExtensionSignerTrustStore(dbService.client),
      runMutatingOperation: (operation) => this.runMutatingOperation(operation),
      onTrustedSignersChanged: () => this.emitTrustedSignersChanged()
    })
    this.repositories = new ExtensionRepositoryManager({
      store: new ExtensionRepositoryStore(dbService.client, {
        allowInsecureLocalUrls: !app.isPackaged
      }),
      fetcher: new ExtensionRepositoryFetcher(networkService, {
        allowInsecureLocalUrls: !app.isPackaged
      }),
      iconManager,
      taskRun: container.get('task-run'),
      i18n: container.get('i18n'),
      apiVersion: EXTENSION_API_VERSION,
      allowInsecureLocalUrls: !app.isPackaged,
      getInstalledVersions: () => this.installations?.getInstalledVersionMap() ?? new Map(),
      onRepositoriesChanged: () => this.ipc.send('extension:repositories-changed'),
      onCatalogChanged: () => this.ipc.send('extension:catalog-changed')
    })
    await this.repositories.init()

    this.webviews = new ExtensionWebviewSessionManager({
      resolveDocumentUrl: (extensionId, entry) => uiAssetServer.documentUrl(extensionId, entry),
      resolvePage: (runtimeHandle, pageId) =>
        this.contributions?.webviews.getPage(runtimeHandle, pageId) ?? null,
      resolveDialog: (runtimeHandle, dialogId) =>
        this.contributions?.webviews.getDialog(runtimeHandle, dialogId) ?? null,
      resolvePageByExtension: (extensionId, pageId) =>
        this.contributions?.webviews.getPageByExtension(extensionId, pageId) ?? null,
      onSessionsChanged: (sessions) =>
        this.ipc.send('extension:webview-sessions-changed', sessions),
      onWebviewMessage: (event) => this.ipc.send('extension:webview-message', event)
    })
    this.capabilities = new ExtensionCapabilityGateway({
      automation: container.get('automation'),
      command: container.get('command'),
      db: container.get('db'),
      i18n: container.get('i18n'),
      ingest: container.get('ingest'),
      network: container.get('network'),
      notify: container.get('notify'),
      scraper: container.get('scraper'),
      taskRun: container.get('task-run'),
      webviewSessions: this.webviews,
      resolveRuntimeHandle: (runtimeHandle) =>
        this.runtime?.resolveRuntimeHandle(runtimeHandle) ?? null
    })
    this.contributions = new ExtensionContributionRegistry({
      command: container.get('command'),
      scraper: container.get('scraper'),
      deeplink: container.get('deeplink'),
      moduleHooks: {
        bootstrap: bootstrapHooks,
        db: dbService.hooks,
        i18n: container.get('i18n').hooks,
        window: container.get('window').hooks,
        scraper: container.get('scraper').hooks,
        ingest: container.get('ingest').hooks,
        scanner: container.get('scanner').hooks,
        launcher: container.get('launcher').hooks,
        monitor: container.get('monitor').hooks
      },
      sendHostEvent: (name, payload) => this.runtime.sendEventToHost(name, payload),
      onContributionsChanged: () => this.emitContributionSnapshotChanged(),
      onEntityMenusRefreshRequested: (event) =>
        this.ipc.send('extension:entity-menus-refresh-requested', event),
      resolveRuntimeHandle: (runtimeHandle) =>
        this.runtime?.resolveRuntimeHandle(runtimeHandle) ?? null,
      requestHost: (method, params, options) => this.runtime.requestHost(method, params, options)
    })
    this.runtime = new RuntimeManager({
      hostModulePath: resolveInsideRoot(app.getAppPath(), 'out', 'main', 'extension-host.js'),
      hostInspect: getBootstrapArgs().extensionHostInspect,
      capabilities: this.capabilities,
      contributions: this.contributions,
      webviews: this.webviews,
      getUiLocale: () => container.get('i18n').locale,
      onRuntimeStateChanged: (extensionId, state) =>
        this.emitRuntimeStateChanged(extensionId, state)
    })
    this.developmentWatcher = new ExtensionDevelopmentWatcher((extensionId) => {
      this.installations.markDevelopmentChanged(extensionId)
    })
    this.installations = new ExtensionInstallationManager({
      layout,
      view: new ExtensionInstallationView(layout, installationStore),
      store: installationStore,
      runtime: this.runtime,
      contributions: this.contributions,
      developmentWatcher: this.developmentWatcher,
      packageCommitter: this.packageCommitter,
      iconManager,
      runMutatingOperation: (operation) => this.runMutatingOperation(operation),
      onInstallationsChanged: () => this.emitInstallationsChanged(),
      onContributionSnapshotChanged: () => this.emitContributionSnapshotChanged(),
      onDevelopmentStaleChanged: (extensionIds) =>
        this.ipc.send('extension:development-stale-changed', { extensionIds })
    })
    bindExtensionLifecycleHookPoints(this.installations.hooks, this.contributions.hooks)

    this.installer = new ExtensionInstallerManager({
      layout,
      runtime: this.runtime,
      repositories: this.repositories,
      installations: this.installations,
      signers: this.signers,
      packageDownloader,
      packageExtractor,
      packageVerifier,
      packageCommitter: this.packageCommitter,
      taskRun: container.get('task-run'),
      i18n: container.get('i18n'),
      runMutatingOperation: (operation) => this.runMutatingOperation(operation),
      onInstallationsChanged: () => this.emitInstallationsChanged(),
      onTrustedSignersChanged: () => this.emitTrustedSignersChanged()
    })
    this.updates = new ExtensionUpdateManager({
      installer: this.installer,
      repositories: this.repositories,
      updatePlanner: new ExtensionUpdatePlanner({
        repositories: this.repositories,
        installations: installationStore,
        createReleasePlan: (candidate) => this.installer.createRepositoryReleasePlan(candidate)
      }),
      onAutomaticUpdateRunChanged: (state) =>
        this.ipc.send('extension:automatic-update-run-changed', state)
    })

    registerExtensionIpc(this, this.ipc)
    await this.installations.init()
    this.runStartupAutomaticUpdatesInBackground()
    log.info('Initialized')
  }

  getPaths(): ExtensionServicePaths {
    return this.paths
  }

  async dispose(): Promise<void> {
    await this.developmentWatcher.stop()
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

  private emitRuntimeStateChanged(extensionId: string, state: ExtensionRuntimeState): void {
    const runtimeInfo = this.installations.getRuntimeInfo(extensionId, state)
    if (!runtimeInfo) {
      return
    }

    this.ipc.send('extension:runtime-state-changed', {
      extensionId,
      ...runtimeInfo
    })
  }

  private emitTrustedSignersChanged(): void {
    this.ipc.send('extension:trusted-signers-changed')
  }

  private runStartupAutomaticUpdatesInBackground(): void {
    queueMicrotask(() => {
      this.updates.runStartupAutomaticUpdates().catch((error) => {
        log.warn('Startup automatic extension updates failed.', error)
      })
    })
  }

  private async recoverPackages(): Promise<void> {
    const recovery = await this.packageRecovery.recover()

    for (const action of recovery.actions) {
      log.info('Extension package recovery action:', action)
    }

    for (const issue of recovery.issues) {
      log.warn('Extension package recovery issue:', issue)
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
