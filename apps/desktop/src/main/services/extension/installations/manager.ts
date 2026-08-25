import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { app } from 'electron'
import { mkdir, rm } from 'node:fs/promises'
import { createLogger } from '@main/log'
import type { ExtensionRuntimeMetadata } from '@kisaki3/extension-api'
import type { ExtensionRegistryPackageIcon } from '@kisaki3/extension-registry'
import type {
  ExtensionInstalledPackageInfo,
  ExtensionInstalledRuntimeInfo,
  ExtensionPurgeDataRequest,
  ExtensionUpdatePolicyRequest
} from '@shared/extension'
import type { ExtensionRuntimeChangeCause, ExtensionRuntimeState, ExtensionRuntimeManager } from '../runtime'
import type { ExtensionContributionRegistry } from '../contributions'
import type {
  ExtensionDevelopmentWatcher,
  ExtensionDevelopmentWatchTarget
} from '../development-watcher'
import {
  type ExtensionPackageCommitter,
  type ExtensionPackageLayout,
  readExtensionManifestFile,
  validateExtensionFileExists
} from '../packages'
import {
  type ExtensionIconManager,
  type ExtensionWebviewUiSource,
  resolveExtensionUiRootPath
} from '../assets'
import { resolveExtensionFilePath } from '@shared/extension/manifest'
import { requireSafeExtensionId, resolveInsideRoot } from '@shared/extension/path-confinement'
import { isInsideOrEqualPath } from '@shared/utils/path'
import { createExtensionRuntimeMetadata, type ExtensionInstalledEntry } from '../types'
import { createExtensionInstallationsHooks } from './hooks'
import { ExtensionInstallationStore } from './store'
import { ExtensionInstallationView } from './view'
import { getBootstrapArgs } from '@main/bootstrap/args'
import type { DevelopmentExtension } from '@shared/bootstrap'

const log = createLogger('Extension')

export interface ExtensionInstallationManagerOptions {
  layout: ExtensionPackageLayout
  view: ExtensionInstallationView
  store: ExtensionInstallationStore
  runtime: ExtensionRuntimeManager
  contributions: ExtensionContributionRegistry
  developmentWatcher: ExtensionDevelopmentWatcher
  packageCommitter: ExtensionPackageCommitter
  iconManager: ExtensionIconManager
  runMutatingOperation<T>(operation: () => Promise<T>): Promise<T>
  onInstallationsChanged?: () => void
  onContributionSnapshotChanged?: () => void
  onDevelopmentStaleChanged?: (extensionIds: string[]) => void
}

export class ExtensionInstallationManager {
  readonly store: ExtensionInstallationStore
  readonly hooks = createExtensionInstallationsHooks()

  private readonly layout: ExtensionPackageLayout
  private readonly view: ExtensionInstallationView
  private readonly runtime: ExtensionRuntimeManager
  private readonly contributions: ExtensionContributionRegistry
  private readonly developmentWatcher: ExtensionDevelopmentWatcher
  private readonly packageCommitter: ExtensionPackageCommitter
  private readonly iconManager: ExtensionIconManager
  private installedEntries: readonly ExtensionInstalledEntry[] = []
  private installedById = new Map<string, ExtensionInstalledEntry>()
  private devExtensionEntries = new Map<string, ExtensionInstalledEntry>()
  /** Development extensions whose on-disk code is newer than what the host is running. */
  private readonly developmentStaleIds = new Set<string>()

  constructor(private readonly options: ExtensionInstallationManagerOptions) {
    this.layout = options.layout
    this.view = options.view
    this.store = options.store
    this.runtime = options.runtime
    this.contributions = options.contributions
    this.developmentWatcher = options.developmentWatcher
    this.packageCommitter = options.packageCommitter
    this.iconManager = options.iconManager
  }

  async init(): Promise<void> {
    this.devExtensionEntries = await this.resolveDevelopmentExtensions()
    await this.refresh()
    await this.applyRuntimeState({ cause: 'startup' })
  }

  async refresh(): Promise<readonly ExtensionInstalledEntry[]> {
    const entries = await this.view.refresh()
    this.installedEntries =
      this.devExtensionEntries.size > 0
        ? [
            ...entries.filter((entry) => !this.devExtensionEntries.has(entry.id)),
            ...this.devExtensionEntries.values()
          ]
        : entries
    this.installedById = new Map()

    for (const entry of this.installedEntries) {
      if (!this.installedById.has(entry.id)) {
        this.installedById.set(entry.id, entry)
      }
    }

    this.iconManager.setAvailableIcons(
      'installed',
      collectInstalledSnapshotIcons(this.installedEntries)
    )

    return this.installedEntries
  }

  listEntries(): readonly ExtensionInstalledEntry[] {
    return this.installedEntries
  }

  async listPackageInfo(): Promise<ExtensionInstalledPackageInfo[]> {
    await this.refresh()
    return this.installedEntries.map((entry) =>
      toExtensionInstalledPackageInfo(entry, this.getRuntimeState(entry.id), (icon) =>
        this.iconManager.getIconUrl(icon)
      )
    )
  }

  get(extensionId: string): ExtensionInstalledEntry | undefined {
    return this.installedById.get(requireSafeExtensionId(extensionId))
  }

  require(extensionId: string): ExtensionInstalledEntry {
    const safeExtensionId = requireSafeExtensionId(extensionId)
    const entry = this.installedById.get(safeExtensionId)
    if (!entry) {
      throw new Error(`Extension "${safeExtensionId}" is not present in the installed view`)
    }

    return entry
  }

  async requireUserInstalled(extensionId: string): Promise<ExtensionInstalledEntry> {
    const safeExtensionId = requireSafeExtensionId(extensionId)
    const installation = this.store.get(safeExtensionId)
    if (!installation) {
      throw new Error(`Extension "${safeExtensionId}" is not installed`)
    }

    await this.refresh()
    return this.require(safeExtensionId)
  }

  getInstalledVersionMap(): ReadonlyMap<string, string> {
    const versions = new Map<string, string>()
    for (const entry of this.installedEntries) {
      if (entry.version) {
        versions.set(entry.id, entry.version)
      }
    }
    return versions
  }

  createRuntimeMetadata(extensionId: string): ExtensionRuntimeMetadata {
    const entry = this.require(extensionId)
    return this.createInstalledRuntimeMetadata(entry)
  }

  /**
   * Resolves how an extension's webview UI assets are delivered: from a dev
   * server in development, otherwise from the manifest `ui` root inside the
   * installed package. Returns null when the extension declares no UI.
   */
  resolveWebviewUiSource(extensionId: string): ExtensionWebviewUiSource | null {
    const entry = this.get(extensionId)
    if (!entry?.manifest?.ui) {
      return null
    }

    if (entry.uiDevServerOrigin) {
      return { kind: 'dev-server', origin: entry.uiDevServerOrigin }
    }

    return {
      kind: 'package',
      rootPath: resolveExtensionUiRootPath(entry.packagePath, entry.manifest.ui)
    }
  }

  getRuntimeState(extensionId: string): ExtensionRuntimeState | null {
    return this.runtime.getRuntimeState(requireSafeExtensionId(extensionId))
  }

  getRuntimeInfo(
    extensionId: string,
    runtimeState: ExtensionRuntimeState | null = this.getRuntimeState(extensionId)
  ): ExtensionInstalledRuntimeInfo | null {
    const entry = this.get(extensionId)
    if (!entry) {
      return null
    }

    return toExtensionInstalledRuntimeInfo(entry, runtimeState)
  }

  async enable(extensionId: string): Promise<ExtensionInstalledEntry> {
    return this.options.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(extensionId)
      this.assertUserManaged(safeExtensionId, 'enable')
      const previous = this.store.require(safeExtensionId)
      this.store.setEnabled(safeExtensionId, true)
      try {
        await this.refresh()
        await this.applyRuntimeState({ cause: 'enable' })
        this.assertRuntimeReady(safeExtensionId, 'enable')
      } catch (error) {
        this.store.setEnabled(safeExtensionId, previous.enabled)
        await this.refresh()
        await this.applyRuntimeState({ cause: 'disable' })
        throw error
      }
      this.emitInstallationsChanged()
      this.hooks.enabled.dispatch({ extensionId: safeExtensionId })
      return this.require(safeExtensionId)
    })
  }

  async disable(extensionId: string): Promise<ExtensionInstalledEntry> {
    return this.options.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(extensionId)
      this.assertUserManaged(safeExtensionId, 'disable')
      this.store.setEnabled(safeExtensionId, false)
      await this.refresh()
      await this.applyRuntimeState({ cause: 'disable' })
      this.emitInstallationsChanged()
      this.hooks.disabled.dispatch({ extensionId: safeExtensionId })
      return this.require(safeExtensionId)
    })
  }

  async isEnabled(extensionId: string): Promise<boolean> {
    const safeExtensionId = requireSafeExtensionId(extensionId)
    const installedEntry = this.installedById.get(safeExtensionId)
    if (installedEntry?.builtin) {
      return installedEntry.enabled
    }

    const record = this.store.get(safeExtensionId)
    if (!record) {
      throw new Error(`Extension "${safeExtensionId}" is not installed`)
    }

    return record.enabled
  }

  async setUpdatePolicy(request: ExtensionUpdatePolicyRequest): Promise<ExtensionInstalledEntry> {
    return this.options.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(request.extensionId)
      this.assertUserManaged(safeExtensionId, 'set update policy')
      const installation = this.store.require(safeExtensionId)
      const pinnedVersion =
        request.updatePolicy === 'pinned' ? (request.pinnedVersion ?? installation.version) : null

      this.store.setUpdatePolicy(
        safeExtensionId,
        request.updatePolicy,
        pinnedVersion,
        request.includePreviewUpdates
      )
      await this.refresh()
      this.emitInstallationsChanged()
      return this.require(safeExtensionId)
    })
  }

  async uninstall(extensionId: string): Promise<void> {
    await this.options.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(extensionId)
      this.assertUserManaged(safeExtensionId, 'uninstall')
      const previous = await this.requireUserInstalled(safeExtensionId)
      let packageRemoved = false

      try {
        await this.runtime.unloadExtension(safeExtensionId, 'disable')
        this.contributions.assertReleased(safeExtensionId, 'uninstall')
        await this.syncDevelopmentWatcherTargets(this.runtime.getDesiredExtensions())
        await this.packageCommitter.removeActivePackage({
          workspaceId: randomUUID(),
          extensionId: safeExtensionId
        })
        packageRemoved = true
        await this.refresh()
        await this.applyRuntimeState({ cause: 'uninstall' })
        this.emitInstallationsChanged()
      } catch (error) {
        await this.refresh()
        await this.applyRuntimeState({
          cause: 'uninstall',
          forceReloadIds: !packageRemoved && previous.enabled ? [safeExtensionId] : []
        })
        throw error
      }
    })
  }

  async purgeData(request: ExtensionPurgeDataRequest): Promise<void> {
    await this.options.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(request.extensionId)
      this.assertUserManaged(safeExtensionId, 'purge data')

      const installation = this.store.get(safeExtensionId)
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
            this.store.setEnabled(safeExtensionId, false)
            disabledForPurge = true
          }
          await this.refresh()
          await this.runtime.unloadExtension(safeExtensionId, 'disable')
          this.contributions.assertReleased(safeExtensionId, 'purge data')
          await this.applyRuntimeState({ cause: 'disable' })
          this.emitInstallationsChanged()
        }

        await Promise.all([
          rm(this.layout.dataPath(safeExtensionId), { recursive: true, force: true }),
          rm(this.layout.runtimeTempPath(safeExtensionId), { recursive: true, force: true })
        ])
      } catch (error) {
        if (installation && disabledForPurge) {
          await this.restoreEnabledAfterFailedPurge(safeExtensionId)
        }
        throw error
      }
    })
  }

  /**
   * Reloads one extension on demand. The shared host is restarted, so every
   * desired extension picks up its latest on-disk code; readiness is asserted
   * for the requested extension only.
   */
  async reload(extensionId: string): Promise<ExtensionInstalledEntry> {
    return this.options.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(extensionId)
      this.devExtensionEntries = await this.resolveDevelopmentExtensions()
      await this.refresh()
      await this.applyRuntimeState({ cause: 'user-reload', forceReloadIds: [safeExtensionId] })
      this.assertRuntimeReady(safeExtensionId, 'reload')
      return this.require(safeExtensionId)
    })
  }

  /**
   * Restarts the extension host, re-reading every package from disk first so any
   * pending development changes are applied. Backs the explicit reload action.
   */
  async restartHost(): Promise<void> {
    await this.options.runMutatingOperation(async () => {
      this.devExtensionEntries = await this.resolveDevelopmentExtensions()
      await this.refresh()
      await this.applyRuntimeState({ cause: 'user-reload', forceReloadAll: true })
      this.emitInstallationsChanged()
    })
  }

  /**
   * Records that a development extension's built output changed on disk without
   * reloading it. Surfaces the pending change to the renderer; applying it is a
   * user action.
   */
  markDevelopmentChanged(extensionId: string): void {
    const safeExtensionId = requireSafeExtensionId(extensionId)
    if (!this.devExtensionEntries.has(safeExtensionId)) {
      return
    }

    this.developmentStaleIds.add(safeExtensionId)
    this.emitDevelopmentStaleChanged()
  }

  getDevelopmentStaleIds(): readonly string[] {
    return [...this.developmentStaleIds]
  }

  /**
   * Tracks runtime load facts. A development extension reaching `running` was
   * just loaded from disk, so any pending stale flag is settled regardless of
   * which path (user reload, package update, crash recovery) restarted it.
   */
  handleRuntimeStateChanged(extensionId: string, state: ExtensionRuntimeState): void {
    if (state.status === 'running' && this.devExtensionEntries.has(extensionId)) {
      this.clearDevelopmentStale(extensionId)
    }
  }

  async applyRuntimeState(options: {
    cause: ExtensionRuntimeChangeCause
    forceReloadIds?: Iterable<string>
    forceReloadAll?: boolean
  }): Promise<void> {
    const desired = this.buildDesiredRuntimeMap()
    const forceReloadIds = options.forceReloadAll ? [...desired.keys()] : options.forceReloadIds
    await this.runtime.reconcile(desired, { cause: options.cause, forceReloadIds })
    await this.syncDevelopmentWatcherTargets(desired)
    this.options.onContributionSnapshotChanged?.()
  }

  async syncDevelopmentWatcherTargets(
    desired: ReadonlyMap<string, ExtensionRuntimeMetadata> | readonly ExtensionRuntimeMetadata[]
  ): Promise<void> {
    await this.developmentWatcher.updateTargets(this.createDevelopmentWatchTargets(desired))
  }

  assertRuntimeReady(extensionId: string, operation: string): void {
    if (!this.runtime.getDesiredExtensions().has(extensionId)) {
      throw new Error(
        `Extension ${operation} did not start because "${extensionId}" is not runtime-ready.`
      )
    }

    this.assertRuntimeReadyIfDesired(extensionId, operation)
  }

  assertRuntimeReadyIfDesired(extensionId: string, operation: string): void {
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

  /**
   * Loads every requested development extension directly from its project root
   * (manifest.json + built `dist/`), VS Code style. Invalid ones are skipped.
   */
  private async resolveDevelopmentExtensions(): Promise<Map<string, ExtensionInstalledEntry>> {
    const entries = new Map<string, ExtensionInstalledEntry>()

    for (const development of getBootstrapArgs().developmentExtensions) {
      const entry = await this.resolveDevelopmentExtension(development)
      if (entry) {
        entries.set(entry.id, entry)
      }
    }

    return entries
  }

  private async resolveDevelopmentExtension(
    development: DevelopmentExtension
  ): Promise<ExtensionInstalledEntry | null> {
    const packagePath = path.resolve(development.path)
    const manifestPath = resolveInsideRoot(packagePath, 'manifest.json')

    try {
      const parsed = await readExtensionManifestFile(manifestPath)
      if (!parsed.manifest) {
        throw new Error(parsed.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
      }

      const { manifest } = parsed
      const issues = await validateExtensionFileExists(packagePath, manifest.entry, '$.entry')
      if (manifest.ui && !development.uiDevServerOrigin) {
        issues.push(...(await validateExtensionFileExists(packagePath, manifest.ui, '$.ui')))
      }
      if (manifest.icon) {
        issues.push(...(await validateExtensionFileExists(packagePath, manifest.icon, '$.icon')))
      }
      if (issues.length > 0) {
        throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
      }

      const dataPath = this.layout.dataPath(manifest.id)
      const tempPath = this.layout.runtimeTempPath(manifest.id)
      await Promise.all([
        mkdir(dataPath, { recursive: true }),
        mkdir(tempPath, { recursive: true })
      ])

      log.info('Registered development extension.', {
        extensionId: manifest.id,
        extensionPath: packagePath,
        uiDevServerOrigin: development.uiDevServerOrigin ?? null
      })

      return {
        builtin: true,
        id: manifest.id,
        directoryName: path.basename(packagePath),
        status: 'ready',
        manifest,
        issues: [],
        enabled: true,
        version: manifest.version,
        categories: manifest.categories,
        source: null,
        updatePolicy: null,
        pinnedVersion: null,
        includePreviewUpdates: null,
        installedAt: null,
        updatedAt: null,
        packagePath,
        manifestPath,
        developmentReloadPath: resolveExtensionHostReloadPath(packagePath, manifest.entry),
        uiDevServerOrigin: development.uiDevServerOrigin ?? null,
        dataPath,
        tempPath
      }
    } catch (error) {
      log.error('Failed to load development extension.', error, { extensionPath: packagePath })
      return null
    }
  }

  private emitDevelopmentStaleChanged(): void {
    this.options.onDevelopmentStaleChanged?.([...this.developmentStaleIds])
  }

  private clearDevelopmentStale(extensionId: string): void {
    if (!this.developmentStaleIds.delete(extensionId)) {
      return
    }

    this.emitDevelopmentStaleChanged()
  }

  private buildDesiredRuntimeMap(): Map<string, ExtensionRuntimeMetadata> {
    const desired = new Map<string, ExtensionRuntimeMetadata>()

    for (const entry of this.installedEntries) {
      if (!entry.enabled || entry.status !== 'ready' || !entry.manifest) {
        continue
      }

      desired.set(
        entry.id,
        this.devExtensionEntries.has(entry.id)
          ? createExtensionRuntimeMetadata(entry, { mode: 'development' })
          : this.createInstalledRuntimeMetadata(entry)
      )
    }

    return desired
  }

  private createInstalledRuntimeMetadata(entry: ExtensionInstalledEntry): ExtensionRuntimeMetadata {
    return createExtensionRuntimeMetadata(entry, {
      mode: entry.builtin && !app.isPackaged ? 'development' : 'production'
    })
  }

  private createDevelopmentWatchTargets(
    desired: ReadonlyMap<string, ExtensionRuntimeMetadata> | readonly ExtensionRuntimeMetadata[]
  ): ExtensionDevelopmentWatchTarget[] {
    const targets: ExtensionDevelopmentWatchTarget[] = []

    for (const metadata of desired.values()) {
      if (metadata.mode !== 'development') {
        continue
      }

      const entry = this.installedById.get(metadata.id)
      const developmentReloadPath = entry?.developmentReloadPath
      if (!developmentReloadPath) {
        continue
      }

      targets.push({
        extensionId: metadata.id,
        watchPaths: createDevelopmentWatchPaths(entry, developmentReloadPath),
        ignoredPaths: createDevelopmentIgnoredPaths(entry, developmentReloadPath)
      })
    }

    return targets
  }

  private async restoreEnabledAfterFailedPurge(extensionId: string): Promise<void> {
    try {
      this.store.setEnabled(extensionId, true)
      await this.refresh()
      await this.applyRuntimeState({ cause: 'enable', forceReloadIds: [extensionId] })
      this.emitInstallationsChanged()
    } catch (error) {
      log.error('Failed to restore extension after data purge failure.', error, {
        extensionId: extensionId
      })
    }
  }

  private assertUserManaged(extensionId: string, operation: string): void {
    const entry = this.installedById.get(requireSafeExtensionId(extensionId))
    if (entry?.builtin) {
      throw new Error(
        `Built-in extension "${extensionId}" is managed by Kisaki and cannot use ${operation}.`
      )
    }
  }

  private emitInstallationsChanged(): void {
    this.options.onInstallationsChanged?.()
  }
}

function toExtensionInstalledPackageInfo(
  entry: ExtensionInstalledEntry,
  runtimeState: ExtensionRuntimeState | null,
  resolveRegistryIconUrl: (icon: ExtensionRegistryPackageIcon | null | undefined) => string | null
): ExtensionInstalledPackageInfo {
  const repositoryPackage =
    entry.source?.kind === 'repository' ? entry.source.snapshot.package : null
  const registryIconUrl = resolveRegistryIconUrl(repositoryPackage?.icon ?? null)
  return {
    ...toExtensionInstalledRuntimeInfo(entry, runtimeState),
    builtin: entry.builtin,
    id: entry.id,
    name: repositoryPackage?.name ?? entry.manifest?.name ?? entry.id,
    version: entry.version,
    description: repositoryPackage?.description ?? entry.manifest?.description,
    author: repositoryPackage?.owner?.name ?? entry.manifest?.author,
    homepage: repositoryPackage?.homepage ?? entry.manifest?.homepage,
    iconUrl:
      registryIconUrl ??
      (entry.manifest?.icon
        ? pathToFileURL(resolveExtensionFilePath(entry.packagePath, entry.manifest.icon)).toString()
        : undefined),
    categories: repositoryPackage?.categories ?? entry.categories,
    enabled: entry.enabled,
    status: entry.status,
    installationSource: entry.source,
    updatePolicy: entry.updatePolicy ?? undefined,
    pinnedVersion: entry.pinnedVersion,
    includePreviewUpdates: entry.includePreviewUpdates,
    installedAt: entry.installedAt,
    directory: entry.packagePath,
    issues: entry.issues
  }
}

function collectInstalledSnapshotIcons(
  entries: readonly ExtensionInstalledEntry[]
): readonly ExtensionRegistryPackageIcon[] {
  return entries.flatMap((entry) => {
    const icon = entry.source?.kind === 'repository' ? entry.source.snapshot.package.icon : null
    return icon ? [icon] : []
  })
}

function createDevelopmentWatchPaths(
  entry: ExtensionInstalledEntry,
  developmentReloadPath: string
): string[] {
  const watchPaths = [developmentReloadPath, entry.manifestPath]

  if (entry.manifest?.icon) {
    watchPaths.push(resolveExtensionFilePath(entry.packagePath, entry.manifest.icon))
  }

  return watchPaths
}

function createDevelopmentIgnoredPaths(
  entry: ExtensionInstalledEntry,
  developmentReloadPath: string
): string[] {
  if (!entry.manifest?.ui || !entry.uiDevServerOrigin) {
    return []
  }

  const uiRootPath = resolveExtensionUiRootPath(entry.packagePath, entry.manifest.ui)
  if (
    path.resolve(uiRootPath) === path.resolve(developmentReloadPath) ||
    !isInsideOrEqualPath(developmentReloadPath, uiRootPath)
  ) {
    return []
  }

  return [uiRootPath]
}

function resolveExtensionHostReloadPath(packagePath: string, entryPath: string): string {
  const entryDir = path.posix.dirname(entryPath)
  return entryDir === '.' ? packagePath : resolveExtensionFilePath(packagePath, entryDir)
}

function toExtensionInstalledRuntimeInfo(
  entry: ExtensionInstalledEntry,
  runtimeState: ExtensionRuntimeState | null
): ExtensionInstalledRuntimeInfo {
  const runtimeStatus =
    entry.enabled && entry.status === 'ready' ? (runtimeState?.status ?? 'stopped') : 'stopped'
  const runtimeError = runtimeStatus === 'failed' ? (runtimeState?.error ?? null) : null
  const runtimeDiagnostics =
    entry.enabled && entry.status === 'ready' ? (runtimeState?.diagnostics ?? []) : []

  return {
    runtimeStatus,
    runtimeError,
    runtimeDiagnostics
  }
}
