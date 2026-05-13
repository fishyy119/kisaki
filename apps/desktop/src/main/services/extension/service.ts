import path from 'node:path'
import { randomUUID } from 'node:crypto'
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
  ExtensionCatalogSearchRequest,
  ExtensionCatalogSearchResult,
  ExtensionContributionSnapshot,
  ExtensionCreateInstallPlanRequest,
  ExtensionCreateLocalInstallPlanRequest,
  ExtensionEntityMenuInvokeRequest,
  ExtensionEntityMenuInvokeResponse,
  ExtensionEntityMenuReleaseRequest,
  ExtensionEntityMenuResolveRequest,
  ExtensionInstallFromFileRequest,
  ExtensionInstallPlan,
  ExtensionInstallReleaseRequest,
  ExtensionPurgeDataRequest,
  ExtensionRepositoryCreateRequest,
  ExtensionRepositoryInfo,
  ExtensionRepositoryRefreshResult,
  ExtensionRepositoryUpdateRequest,
  ExtensionResolvedEntityMenu,
  ExtensionSettingsPanelCallbackResponse,
  ExtensionSettingsPanelRegistrationInfo,
  ExtensionSettingsPanelInvokeRequest,
  ExtensionSettingsPanelOpenRequest,
  ExtensionSettingsPanelOpenResponse,
  ExtensionSettingsPanelRefreshRequest,
  ExtensionSettingsPanelRefreshResponse,
  ExtensionSettingsPanelReleaseRequest,
  ExtensionSettingsPanelSubmitRequest,
  ExtensionThemeRegistrationInfo,
  ExtensionUpdateAllResult,
  ExtensionUpdateCheckResult,
  ExtensionUpdatePolicyRequest,
  ExtensionUpdateRequest
} from '@shared/extension'
import type { ExtensionCatalogEntry, ExtensionServicePaths } from './types'
import { createExtensionRuntimeMetadata } from './types'
import { ExtensionInstallPlanner } from './installer/planner'
import { ExtensionPackageInstaller } from './installer/manager'
import { registerExtensionIpc } from './ipc'
import { ExtensionReloadWatcher } from './reload-watcher'
import {
  assertExtensionPackageOperationNotAborted,
  ExtensionIconManager,
  ExtensionPackageDownloader,
  ExtensionPackageExtractor,
  ExtensionPackageLayout,
  ExtensionPackageOperationRegistry,
  ExtensionPackageTransaction,
  ExtensionPackageVerifier
} from './packages'
import { ExtensionInstallationCatalog, ExtensionInstallationStore } from './installations'
import {
  ExtensionRepositoryFetcher,
  ExtensionRepositoryManager,
  ExtensionRepositoryStore,
  type ExtensionRepositoryInstallCandidate
} from './repositories'
import {
  RuntimeManager,
  type ExtensionRuntimeChangeCause,
  type ExtensionRuntimeState
} from './runtime/manager'
import {
  ExtensionSignerTrustManager,
  ExtensionSignerTrustStore,
  type TrustExtensionSignerInput
} from './signers'
import { ExtensionUpdatePlanner, type ExtensionUpdatePlan } from './updates'
import { ExtensionCapabilityGateway } from './capabilities'
import { ExtensionContributionRegistry } from './contributions/registry'
import { readExtensionManifestFile, validateInstalledExtensionPackage } from './packages/manifest'
import { requireSafeExtensionId, resolveInsideRoot } from './shared/path-confinement'

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
    'ingest',
    'command',
    'background-task',
    'deeplink'
  ] as const satisfies readonly ServiceName[]

  private layout!: ExtensionPackageLayout
  private catalog!: ExtensionInstallationCatalog
  private installationStore!: ExtensionInstallationStore
  private signerTrustManager!: ExtensionSignerTrustManager
  private packageTransaction!: ExtensionPackageTransaction
  private packageVerifier!: ExtensionPackageVerifier
  private packageInstaller!: ExtensionPackageInstaller
  private installPlanner!: ExtensionInstallPlanner
  private updatePlanner!: ExtensionUpdatePlanner
  private paths!: ExtensionServicePaths
  private ipc!: IpcService
  private event!: EventService
  private runtime!: RuntimeManager
  private reloadWatcher!: ExtensionReloadWatcher
  private repositoryManager!: ExtensionRepositoryManager
  private capabilities!: ExtensionCapabilityGateway
  private contributions!: ExtensionContributionRegistry
  private snapshot: readonly ExtensionCatalogEntry[] = []
  private byId = new Map<string, ExtensionCatalogEntry>()
  private devExtensionEntry: ExtensionCatalogEntry | null = null
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

    this.ipc = container.get('ipc')
    this.event = container.get('event')
    this.layout = new ExtensionPackageLayout(this.paths)
    this.installationStore = new ExtensionInstallationStore(dbService.db)
    this.signerTrustManager = new ExtensionSignerTrustManager(
      new ExtensionSignerTrustStore(dbService.db)
    )
    this.packageTransaction = new ExtensionPackageTransaction(this.layout, dbService.db)
    this.packageVerifier = new ExtensionPackageVerifier()
    this.packageInstaller = new ExtensionPackageInstaller({
      downloader: new ExtensionPackageDownloader(this.layout, networkService),
      extractor: new ExtensionPackageExtractor(this.layout, this.packageVerifier),
      transaction: this.packageTransaction,
      operations: this.packageOperations
    })
    await this.recoverPackageOperations()
    const iconManager = new ExtensionIconManager(rootDir, networkService)
    iconManager.registerProtocolHandler()

    this.repositoryManager = new ExtensionRepositoryManager({
      store: new ExtensionRepositoryStore(dbService.db),
      fetcher: new ExtensionRepositoryFetcher(networkService, {
        allowInsecureLocalUrls: !app.isPackaged
      }),
      iconManager,
      appVersion: app.getVersion(),
      allowInsecureLocalUrls: !app.isPackaged,
      onRepositoriesChanged: () => this.ipc.send('extension:repositories-changed'),
      onCatalogChanged: () => this.ipc.send('extension:catalog-changed')
    })
    await this.repositoryManager.init()
    this.installPlanner = new ExtensionInstallPlanner({
      repositories: this.repositoryManager,
      installations: this.installationStore,
      signers: this.signerTrustManager
    })
    this.updatePlanner = new ExtensionUpdatePlanner({
      repositories: this.repositoryManager,
      installations: this.installationStore,
      installPlanner: this.installPlanner
    })

    this.catalog = new ExtensionInstallationCatalog(this.layout, this.installationStore)
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
    this.reloadWatcher = new ExtensionReloadWatcher((extensionId) =>
      this.runMutatingOperation(() => this.reloadExtensionRuntime(extensionId, 'file-change'))
    )
    registerExtensionIpc(this, this.ipc)

    this.devExtensionEntry = await this.resolveDevExtension()
    await this.refreshCatalog()
    await this.applyRuntimeState({ cause: 'startup' })
    this.repositoryManager.refreshRepositoriesInBackground()
    log.info('[ExtensionService] Initialized')
  }

  getPaths(): ExtensionServicePaths {
    return this.paths
  }

  async refreshCatalog(): Promise<readonly ExtensionCatalogEntry[]> {
    const entries = await this.catalog.refresh()
    this.snapshot = this.devExtensionEntry
      ? [
          ...entries.filter((entry) => entry.id !== this.devExtensionEntry?.id),
          this.devExtensionEntry
        ]
      : entries
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

  listRepositories(): readonly ExtensionRepositoryInfo[] {
    return this.repositoryManager.listRepositories()
  }

  addRepository(request: ExtensionRepositoryCreateRequest): Promise<ExtensionRepositoryInfo> {
    return this.repositoryManager.addRepository(request)
  }

  updateRepository(request: ExtensionRepositoryUpdateRequest): Promise<ExtensionRepositoryInfo> {
    return this.repositoryManager.updateRepository(request)
  }

  removeRepository(repositoryId: string): void {
    this.repositoryManager.removeRepository(repositoryId)
  }

  refreshRepository(repositoryId: string): Promise<ExtensionRepositoryRefreshResult> {
    return this.repositoryManager.refreshRepository(repositoryId)
  }

  refreshRepositories(): Promise<readonly ExtensionRepositoryRefreshResult[]> {
    return this.repositoryManager.refreshRepositories()
  }

  searchCatalog(request: ExtensionCatalogSearchRequest = {}): ExtensionCatalogSearchResult {
    return this.repositoryManager.searchCatalog(request, {
      installedVersions: this.createInstalledVersionMap()
    })
  }

  getExtension(extensionId: string): ExtensionCatalogEntry | undefined {
    return this.byId.get(requireSafeExtensionId(extensionId))
  }

  async createInstallPlan(
    request: ExtensionCreateInstallPlanRequest
  ): Promise<ExtensionInstallPlan> {
    if (request.sourceKind === 'local-file') {
      return this.createLocalInstallPlan(request)
    }

    return this.installPlanner.createRepositoryPlan(request)
  }

  async installRelease(request: ExtensionInstallReleaseRequest): Promise<ExtensionCatalogEntry> {
    const operationId = request.operationId
    const operation = this.packageOperations.start({
      operationId,
      kind: 'install',
      extensionId: request.extensionId
    })

    try {
      operation.phase = 'waiting-lock'
      return await this.runMutatingOperation(async () => {
        assertExtensionPackageOperationNotAborted(operation.controller.signal)
        const candidate = this.repositoryManager.resolveInstallCandidate(request)
        const plan = this.installPlanner.createRepositoryPlanForCandidate(candidate)
        this.installPlanner.assertAccepted(plan, request)

        const prepared = await this.packageInstaller.prepareRepositoryPackageWithOperation(
          {
            operationId,
            manifest: candidate.manifest,
            registryPackage: candidate.registryPackage,
            release: candidate.release,
            artifact: candidate.artifact,
            signal: operation.controller.signal
          },
          operation
        )

        operation.phase = 'commit'
        return this.commitPreparedRepositoryPackage(candidate, plan, request, prepared.packageDir)
      })
    } finally {
      this.packageOperations.finish(operationId)
    }
  }

  async installFromFile(request: ExtensionInstallFromFileRequest): Promise<ExtensionCatalogEntry> {
    const operationId = request.operationId
    const operation = this.packageOperations.start({
      operationId,
      kind: 'local-import'
    })

    try {
      operation.phase = 'waiting-lock'
      return await this.runMutatingOperation(async () => {
        assertExtensionPackageOperationNotAborted(operation.controller.signal)
        const plan = await this.createLocalInstallPlan(
          { sourceKind: 'local-file', filePath: request.filePath },
          operation.controller.signal
        )
        this.installPlanner.assertAccepted(plan, request)

        const prepared = await this.packageInstaller.prepareLocalPackageWithOperation(
          {
            operationId,
            filePath: request.filePath,
            expectedExtensionId: plan.package.id,
            signal: operation.controller.signal
          },
          operation
        )
        const preparedPlan = this.installPlanner.createLocalImportPlan({
          filePath: path.resolve(request.filePath),
          extensionId: prepared.manifest.id,
          name: prepared.manifest.name,
          version: prepared.manifest.version,
          fileSize: prepared.archiveSize,
          artifactSha256: prepared.archiveSha256
        })
        this.installPlanner.assertAccepted(preparedPlan, request)

        operation.phase = 'commit'
        return this.commitPreparedLocalPackage(
          operationId,
          request.filePath,
          preparedPlan,
          request.enabled,
          prepared.packageDir,
          prepared.archiveSha256
        )
      })
    } finally {
      this.packageOperations.finish(operationId)
    }
  }

  async uninstall(extensionId: string): Promise<void> {
    await this.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(extensionId)
      this.assertUserManagedExtension(safeExtensionId, 'uninstall')
      const previous = await this.requireInstalledCatalogEntry(safeExtensionId)
      let handle: Awaited<ReturnType<ExtensionPackageTransaction['uninstallPackage']>> | null = null

      try {
        await this.runtime.unloadExtension(safeExtensionId, 'disable')
        this.contributions.assertReleased(safeExtensionId, 'uninstall')
        await this.syncReloadWatcherTargets(this.runtime.getDesiredExtensions())
        handle = await this.packageTransaction.uninstallPackage({
          operationId: randomUUID(),
          extensionId: safeExtensionId
        })
        await this.refreshCatalog()
        await this.applyRuntimeState({ cause: 'uninstall' })
        await handle.commit()
        this.emitInstallationsChanged()
      } catch (error) {
        if (handle) {
          await handle.rollback().catch((rollbackError) => {
            log.error(
              `[ExtensionService] Failed to roll back extension uninstall "${safeExtensionId}":`,
              rollbackError
            )
          })
        }
        await this.refreshCatalog()
        await this.applyRuntimeState({
          cause: 'uninstall',
          forceReloadIds: previous.enabled ? [safeExtensionId] : []
        })
        throw error
      }
    })
  }

  async purgeData(request: ExtensionPurgeDataRequest): Promise<void> {
    await this.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(request.extensionId)
      this.assertUserManagedExtension(safeExtensionId, 'purge data')

      const installation = this.installationStore.get(safeExtensionId)
      if (installation && !request.force) {
        throw new Error(
          `Extension "${safeExtensionId}" is still installed. Uninstall it before clearing data.`
        )
      }
      if (!installation && this.runtime.getDesiredExtensions().has(safeExtensionId)) {
        throw new Error(
          `Extension "${safeExtensionId}" is still active. Stop it before clearing data.`
        )
      }

      let disabledForPurge = false
      try {
        if (installation) {
          if (installation.enabled) {
            this.installationStore.setEnabled(safeExtensionId, false)
            disabledForPurge = true
          }
          await this.refreshCatalog()
          await this.runtime.unloadExtension(safeExtensionId, 'disable')
          this.contributions.assertReleased(safeExtensionId, 'purge data')
          await this.applyRuntimeState({ cause: 'disable' })
          this.emitInstallationsChanged()
        }

        await Promise.all([
          fse.remove(this.layout.dataPath(safeExtensionId)),
          fse.remove(this.layout.runtimeTempPath(safeExtensionId))
        ])
      } catch (error) {
        if (installation && disabledForPurge) {
          await this.restoreEnabledAfterFailedPurge(safeExtensionId)
        }
        throw error
      }
    })
  }

  async update(request: ExtensionUpdateRequest): Promise<ExtensionCatalogEntry | null> {
    const result = await this.performUpdate(requireSafeExtensionId(request.extensionId), {
      mode: 'manual',
      operationId: request.operationId,
      request
    })
    return result.entry
  }

  async checkUpdates(): Promise<ExtensionUpdateCheckResult> {
    return this.updatePlanner.checkUpdates()
  }

  async updateAll(): Promise<ExtensionUpdateAllResult[]> {
    const plannedUpdates = this.updatePlanner.listAutomaticUpdatePlans()
    const results: ExtensionUpdateAllResult[] = []

    for (const plannedUpdate of plannedUpdates) {
      try {
        const result = await this.performUpdate(plannedUpdate.installation.id, {
          mode: 'automatic',
          operationId: randomUUID()
        })
        results.push({
          extensionId: result.plan.installation.id,
          success: true,
          currentVersion: result.plan.installation.version,
          targetVersion: result.plan.candidate.release.version
        })
      } catch (error) {
        results.push({
          extensionId: plannedUpdate.installation.id,
          success: false,
          currentVersion: plannedUpdate.installation.version,
          targetVersion: plannedUpdate.candidate.release.version,
          error: error instanceof Error ? error.message : 'Unknown extension update error'
        })
      }
    }

    return results
  }

  async setUpdatePolicy(request: ExtensionUpdatePolicyRequest): Promise<ExtensionCatalogEntry> {
    return this.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(request.extensionId)
      this.assertUserManagedExtension(safeExtensionId, 'set update policy')
      const installation = this.installationStore.require(safeExtensionId)
      const pinnedVersion =
        request.updatePolicy === 'pinned' ? (request.pinnedVersion ?? installation.version) : null

      this.installationStore.setUpdatePolicy(safeExtensionId, request.updatePolicy, pinnedVersion)
      await this.refreshCatalog()
      this.emitInstallationsChanged()
      return this.requireCatalogEntry(safeExtensionId)
    })
  }

  cancelOperation(operationId: string): boolean {
    return this.packageOperations.cancel(operationId)
  }

  async enable(extensionId: string): Promise<ExtensionCatalogEntry> {
    return this.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(extensionId)
      this.assertUserManagedExtension(safeExtensionId, 'enable')
      const previous = this.installationStore.require(safeExtensionId)
      this.installationStore.setEnabled(safeExtensionId, true)
      try {
        await this.refreshCatalog()
        await this.applyRuntimeState({ cause: 'enable' })
        this.assertRuntimeReady(safeExtensionId, 'enable')
      } catch (error) {
        this.installationStore.setEnabled(safeExtensionId, previous.enabled)
        await this.refreshCatalog()
        await this.applyRuntimeState({ cause: 'disable' })
        throw error
      }
      this.emitInstallationsChanged()
      this.event.emit('extension:enabled', { extensionId: safeExtensionId })
      return this.requireCatalogEntry(safeExtensionId)
    })
  }

  async disable(extensionId: string): Promise<ExtensionCatalogEntry> {
    return this.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(extensionId)
      this.assertUserManagedExtension(safeExtensionId, 'disable')
      this.installationStore.setEnabled(safeExtensionId, false)
      await this.refreshCatalog()
      await this.applyRuntimeState({ cause: 'disable' })
      this.emitInstallationsChanged()
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

    const record = this.installationStore.get(safeExtensionId)
    if (!record) {
      throw new Error(`Extension "${safeExtensionId}" is not installed`)
    }

    return record.enabled
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

  getSettingsPanelContributions(): readonly ExtensionSettingsPanelRegistrationInfo[] {
    return this.contributions.settingsPanels.getSnapshot()
  }

  getThemeContributions(): readonly ExtensionThemeRegistrationInfo[] {
    return this.contributions.themes.getSnapshot()
  }

  resolveEntityMenu(
    request: ExtensionEntityMenuResolveRequest
  ): Promise<ExtensionResolvedEntityMenu> {
    return this.contributions.entityMenus.resolve(request)
  }

  invokeEntityMenuCallback(
    request: ExtensionEntityMenuInvokeRequest
  ): Promise<ExtensionEntityMenuInvokeResponse> {
    return this.contributions.entityMenus.invoke({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  releaseEntityMenu(request: ExtensionEntityMenuReleaseRequest): Promise<void> {
    return this.contributions.entityMenus.release(request)
  }

  openSettingsPanel(
    request: ExtensionSettingsPanelOpenRequest
  ): Promise<ExtensionSettingsPanelOpenResponse> {
    return this.contributions.settingsPanels.open({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  refreshSettingsPanel(
    request: ExtensionSettingsPanelRefreshRequest
  ): Promise<ExtensionSettingsPanelRefreshResponse> {
    return this.contributions.settingsPanels.refresh({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  submitSettingsPanel(
    request: ExtensionSettingsPanelSubmitRequest
  ): Promise<ExtensionSettingsPanelCallbackResponse> {
    return this.contributions.settingsPanels.submit({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  invokeSettingsPanelNode(
    request: ExtensionSettingsPanelInvokeRequest
  ): Promise<ExtensionSettingsPanelCallbackResponse> {
    return this.contributions.settingsPanels.invoke({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  releaseSettingsPanel(request: ExtensionSettingsPanelReleaseRequest): Promise<void> {
    return this.contributions.settingsPanels.release({
      ...request,
      extensionId: requireSafeExtensionId(request.extensionId)
    })
  }

  async dispose(): Promise<void> {
    await this.reloadWatcher.stop()
    await this.runtime.shutdownHost()
  }

  private async createLocalInstallPlan(
    request: ExtensionCreateLocalInstallPlanRequest,
    signal?: AbortSignal
  ): Promise<ExtensionInstallPlan> {
    const filePath = path.resolve(request.filePath)
    const stat = await fse.stat(filePath)
    if (!stat.isFile() || path.extname(filePath).toLowerCase() !== '.kisx') {
      throw new Error('Local extension package must be a .kisx file.')
    }

    const verified = await this.packageVerifier.verifyArchive({
      archivePath: filePath,
      signal
    })

    return this.installPlanner.createLocalImportPlan({
      filePath,
      extensionId: verified.manifest.id,
      name: verified.manifest.name,
      version: verified.manifest.version,
      fileSize: verified.size,
      artifactSha256: verified.sha256
    })
  }

  private async commitPreparedRepositoryPackage(
    candidate: ExtensionRepositoryInstallCandidate,
    plan: ExtensionInstallPlan,
    request: ExtensionInstallReleaseRequest,
    stagedPackageDir: string
  ): Promise<ExtensionCatalogEntry> {
    if (!candidate.repository.manifestDigest) {
      throw new Error(`Repository "${candidate.repository.id}" does not have a manifest digest.`)
    }

    const extensionId = candidate.registryPackage.id
    const enabled = request.enabled ?? plan.defaultEnabled
    const updatePolicy = request.updatePolicy ?? plan.updatePolicy
    const source = {
      kind: 'repository' as const,
      repositoryId: candidate.repository.id,
      repositoryUrl: candidate.repository.url,
      releaseId: candidate.releaseDigest,
      manifestDigest: candidate.repository.manifestDigest,
      artifact: {
        url: candidate.artifact.url,
        sha256: candidate.artifact.sha256
      },
      ...(plan.signer.fingerprint
        ? {
            signature: {
              keyId: plan.signer.keyId,
              fingerprint: plan.signer.fingerprint
            }
          }
        : {})
    }
    const signerTrusts = request.trustSignerFingerprint
      ? this.createSignerTrustInputs(candidate, plan)
      : []
    const handle = await this.packageTransaction.replaceActivePackage({
      operationId: request.operationId,
      extensionId,
      stagedPackageDir,
      installation: {
        id: extensionId,
        enabled,
        version: candidate.release.version,
        source,
        installReason: 'manual',
        updatePolicy,
        pinnedVersion: updatePolicy === 'pinned' ? candidate.release.version : null,
        channel: candidate.release.channel
      },
      signerTrusts
    })

    try {
      await this.refreshCatalog()
      await this.applyRuntimeState({ cause: 'install', forceReloadIds: [extensionId] })
      if (enabled) {
        this.assertRuntimeReady(extensionId, 'install')
      }
      await handle.commit()
      this.emitInstallationsChanged()
      return this.requireCatalogEntry(extensionId)
    } catch (error) {
      await handle.rollback().catch((rollbackError) => {
        log.error(
          `[ExtensionService] Failed to roll back extension install "${extensionId}":`,
          rollbackError
        )
      })
      await this.refreshCatalog()
      await this.applyRuntimeState({ cause: 'install', forceReloadIds: [extensionId] })
      throw error
    }
  }

  private async performUpdate(
    extensionId: string,
    options: {
      mode: 'manual' | 'automatic'
      operationId: string
      request?: ExtensionUpdateRequest
    }
  ): Promise<{ entry: ExtensionCatalogEntry; plan: ExtensionUpdatePlan }> {
    const operation = this.packageOperations.start({
      operationId: options.operationId,
      kind: 'update',
      extensionId
    })

    try {
      operation.phase = 'waiting-lock'
      return await this.runMutatingOperation(async () => {
        assertExtensionPackageOperationNotAborted(operation.controller.signal)
        const updatePlan = this.updatePlanner.requireUpdatePlan(extensionId, {
          mode: options.mode
        })
        if (options.request) {
          this.updatePlanner.assertAccepted(updatePlan, options.request)
        }
        const candidate = updatePlan.candidate

        const prepared = await this.packageInstaller.prepareRepositoryPackageWithOperation(
          {
            operationId: options.operationId,
            manifest: candidate.manifest,
            registryPackage: candidate.registryPackage,
            release: candidate.release,
            artifact: candidate.artifact,
            signal: operation.controller.signal
          },
          operation
        )

        operation.phase = 'commit'
        const entry = await this.commitPreparedUpdatePackage(
          options.operationId,
          updatePlan,
          prepared.packageDir,
          options.request?.trustSignerFingerprint === true
        )
        return { entry, plan: updatePlan }
      })
    } finally {
      this.packageOperations.finish(options.operationId)
    }
  }

  private async commitPreparedUpdatePackage(
    operationId: string,
    updatePlan: ExtensionUpdatePlan,
    stagedPackageDir: string,
    trustSignerFingerprint: boolean
  ): Promise<ExtensionCatalogEntry> {
    const { candidate, installation, info } = updatePlan
    if (!candidate.repository.manifestDigest) {
      throw new Error(`Repository "${candidate.repository.id}" does not have a manifest digest.`)
    }

    const extensionId = candidate.registryPackage.id
    const source = {
      kind: 'repository' as const,
      repositoryId: candidate.repository.id,
      repositoryUrl: candidate.repository.url,
      releaseId: candidate.releaseDigest,
      manifestDigest: candidate.repository.manifestDigest,
      artifact: {
        url: candidate.artifact.url,
        sha256: candidate.artifact.sha256
      },
      ...(info.signer?.fingerprint
        ? {
            signature: {
              keyId: info.signer.keyId,
              fingerprint: info.signer.fingerprint
            }
          }
        : {})
    }
    const signerTrusts = trustSignerFingerprint
      ? this.createSignerTrustInputs(candidate, updatePlan.installPlan)
      : []

    let handle: Awaited<ReturnType<ExtensionPackageTransaction['replaceActivePackage']>> | null =
      null

    try {
      await this.runtime.unloadExtension(extensionId, 'update')
      await this.syncReloadWatcherTargets(this.runtime.getDesiredExtensions())
      handle = await this.packageTransaction.replaceActivePackage({
        operationId,
        extensionId,
        stagedPackageDir,
        installation: {
          id: extensionId,
          enabled: installation.enabled,
          version: candidate.release.version,
          source,
          installReason: 'update',
          updatePolicy: installation.updatePolicy,
          pinnedVersion: installation.pinnedVersion,
          channel: candidate.release.channel
        },
        signerTrusts
      })
      await this.refreshCatalog()
      await this.applyRuntimeState({ cause: 'package-update', forceReloadIds: [extensionId] })
      if (installation.enabled) {
        this.assertRuntimeReadyIfDesired(extensionId, 'update')
      }
      await handle.commit()
      this.emitInstallationsChanged()
      return this.requireCatalogEntry(extensionId)
    } catch (error) {
      if (handle) {
        await handle.rollback().catch((rollbackError) => {
          log.error(
            `[ExtensionService] Failed to roll back extension update "${extensionId}":`,
            rollbackError
          )
        })
      } else {
        const operationPaths = this.layout.operationPaths(operationId)
        await Promise.all([
          fse.remove(operationPaths.stagingDir).catch(() => undefined),
          fse.remove(operationPaths.downloadPath).catch(() => undefined)
        ])
      }
      await this.refreshCatalog()
      await this.applyRuntimeState({ cause: 'package-update', forceReloadIds: [extensionId] })
      throw error
    }
  }

  private async commitPreparedLocalPackage(
    operationId: string,
    filePath: string,
    plan: ExtensionInstallPlan,
    enabledOverride: boolean | undefined,
    stagedPackageDir: string,
    artifactSha256: string
  ): Promise<ExtensionCatalogEntry> {
    const extensionId = plan.package.id
    const enabled = enabledOverride ?? plan.defaultEnabled
    const handle = await this.packageTransaction.replaceActivePackage({
      operationId,
      extensionId,
      stagedPackageDir,
      installation: {
        id: extensionId,
        enabled,
        version: plan.package.targetVersion,
        source: {
          kind: 'local-file',
          path: path.resolve(filePath),
          artifactSha256
        },
        installReason: 'local-file',
        updatePolicy: 'manual',
        pinnedVersion: null,
        channel: 'stable'
      }
    })

    try {
      await this.refreshCatalog()
      await this.applyRuntimeState({ cause: 'install', forceReloadIds: [extensionId] })
      if (enabled) {
        this.assertRuntimeReady(extensionId, 'install')
      }
      await handle.commit()
      this.emitInstallationsChanged()
      return this.requireCatalogEntry(extensionId)
    } catch (error) {
      await handle.rollback().catch((rollbackError) => {
        log.error(
          `[ExtensionService] Failed to roll back local extension import "${extensionId}":`,
          rollbackError
        )
      })
      await this.refreshCatalog()
      await this.applyRuntimeState({ cause: 'install', forceReloadIds: [extensionId] })
      throw error
    }
  }

  private createSignerTrustInputs(
    candidate: ExtensionRepositoryInstallCandidate,
    plan: ExtensionInstallPlan
  ): readonly TrustExtensionSignerInput[] {
    const fingerprint = plan.signer.fingerprint
    const keyId = plan.signer.keyId
    if (!fingerprint || !keyId) {
      return []
    }

    const signingKey = candidate.manifest.signingKeys.find((key) => key.id === keyId)
    if (!signingKey) {
      throw new Error(`Signing key "${keyId}" is not declared by the repository manifest.`)
    }

    return [
      {
        extensionId: candidate.registryPackage.id,
        fingerprint,
        algorithm: signingKey.algorithm,
        publicKey: signingKey.publicKey,
        label: keyId,
        trustedFromRepositoryId: candidate.repository.id,
        trustedFromRepositoryUrl: candidate.repository.url
      }
    ]
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
    const installation = this.installationStore.get(safeExtensionId)
    if (!installation) {
      throw new Error(`Extension "${safeExtensionId}" is not installed`)
    }

    await this.refreshCatalog()
    return this.requireCatalogEntry(safeExtensionId)
  }

  private runMutatingOperation<T>(operation: () => Promise<T>): Promise<T> {
    return this.operationMutex.runExclusive(operation)
  }

  private createInstalledVersionMap(): ReadonlyMap<string, string> {
    const versions = new Map<string, string>()
    for (const entry of this.snapshot) {
      if (entry.version) {
        versions.set(entry.id, entry.version)
      }
    }
    return versions
  }

  private assertUserManagedExtension(extensionId: string, operation: string): void {
    const entry = this.byId.get(requireSafeExtensionId(extensionId))
    if (entry?.builtin) {
      throw new Error(
        `Built-in extension "${extensionId}" is managed by Kisaki and cannot use ${operation}.`
      )
    }
  }

  private async reloadExtensionRuntime(
    extensionId: string,
    cause: ExtensionRuntimeChangeCause
  ): Promise<void> {
    const safeExtensionId = requireSafeExtensionId(extensionId)
    await this.refreshCatalog()
    this.devExtensionEntry = await this.resolveDevExtension()
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

  private async resolveDevExtension(): Promise<ExtensionCatalogEntry | null> {
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

      const dataPath = this.layout.dataPath(parsed.manifest.id)
      const tempPath = this.layout.runtimeTempPath(parsed.manifest.id)
      await Promise.all([fse.ensureDir(dataPath), fse.ensureDir(tempPath)])

      log.info(
        `[ExtensionService] Registered dev extension override: ${parsed.manifest.id} -> ${extensionPath}`
      )

      return {
        builtin: false,
        id: parsed.manifest.id,
        directoryName: path.basename(extensionPath),
        status: 'ready',
        manifest: parsed.manifest,
        issues: [],
        enabled: true,
        version: parsed.manifest.version,
        categories: parsed.manifest.categories,
        source: null,
        updatePolicy: null,
        pinnedVersion: null,
        channel: null,
        installedAt: null,
        updatedAt: null,
        packagePath: extensionPath,
        manifestPath,
        dataPath,
        tempPath
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

    if (this.devExtensionEntry?.manifest) {
      desired.set(
        this.devExtensionEntry.id,
        createExtensionRuntimeMetadata(this.devExtensionEntry, { mode: 'development' })
      )
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

  private async restoreEnabledAfterFailedPurge(extensionId: string): Promise<void> {
    try {
      this.installationStore.setEnabled(extensionId, true)
      await this.refreshCatalog()
      await this.applyRuntimeState({ cause: 'enable', forceReloadIds: [extensionId] })
      this.emitInstallationsChanged()
    } catch (error) {
      log.error(
        `[ExtensionService] Failed to restore extension "${extensionId}" after data purge failure:`,
        error
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

  private emitInstallationsChanged(): void {
    this.ipc.send('extension:installations-changed')
    this.ipc.send('extension:catalog-changed')
  }

  private async recoverPackageOperations(): Promise<void> {
    const recovery = await this.packageTransaction.recover()

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
