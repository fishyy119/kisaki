import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { app } from 'electron'
import fse from 'fs-extra'
import { createLogger } from '@main/log'
import type { ExtensionRuntimeMetadata } from '@kisaki/extension-api'
import type { EventService } from '@main/services/event'
import type {
  ExtensionInstalledPackageInfo,
  ExtensionPurgeDataRequest,
  ExtensionUpdatePolicyRequest
} from '@shared/extension'
import type { ExtensionRuntimeChangeCause, ExtensionRuntimeState, RuntimeManager } from '../runtime'
import type { ExtensionContributionRegistry } from '../contributions'
import type { ExtensionReloadWatcher } from '../reload-watcher'
import {
  type ExtensionPackageCommitter,
  type ExtensionPackageLayout,
  readExtensionManifestFile,
  resolveExtensionFilePath,
  validateInstalledExtensionPackage
} from '../packages'
import { requireSafeExtensionId, resolveInsideRoot } from '../shared/path-confinement'
import { createExtensionRuntimeMetadata, type ExtensionInstalledEntry } from '../types'
import { ExtensionInstallationStore } from './store'
import { ExtensionInstallationView } from './view'
import { getBootstrapArgs } from '@main/bootstrap/args'

const log = createLogger('Extension')
const FILE_CHANGE_RELOAD_READY_ATTEMPTS = 12
const FILE_CHANGE_RELOAD_READY_DELAY_MS = 250

export interface ExtensionInstallationManagerOptions {
  layout: ExtensionPackageLayout
  view: ExtensionInstallationView
  store: ExtensionInstallationStore
  runtime: RuntimeManager
  contributions: ExtensionContributionRegistry
  reloadWatcher: ExtensionReloadWatcher
  packageCommitter: ExtensionPackageCommitter
  event: EventService
  runMutatingOperation<T>(operation: () => Promise<T>): Promise<T>
  onInstallationsChanged?: () => void
  onContributionSnapshotChanged?: () => void
}

export class ExtensionInstallationManager {
  readonly store: ExtensionInstallationStore

  private readonly layout: ExtensionPackageLayout
  private readonly view: ExtensionInstallationView
  private readonly runtime: RuntimeManager
  private readonly contributions: ExtensionContributionRegistry
  private readonly reloadWatcher: ExtensionReloadWatcher
  private readonly packageCommitter: ExtensionPackageCommitter
  private readonly event: EventService
  private installedEntries: readonly ExtensionInstalledEntry[] = []
  private installedById = new Map<string, ExtensionInstalledEntry>()
  private devExtensionEntry: ExtensionInstalledEntry | null = null

  constructor(private readonly options: ExtensionInstallationManagerOptions) {
    this.layout = options.layout
    this.view = options.view
    this.store = options.store
    this.runtime = options.runtime
    this.contributions = options.contributions
    this.reloadWatcher = options.reloadWatcher
    this.packageCommitter = options.packageCommitter
    this.event = options.event
  }

  async init(): Promise<void> {
    this.devExtensionEntry = await this.resolveDevExtension()
    await this.refresh()
    await this.applyRuntimeState({ cause: 'startup' })
  }

  async refresh(): Promise<readonly ExtensionInstalledEntry[]> {
    const entries = await this.view.refresh()
    this.installedEntries = this.devExtensionEntry
      ? [
          ...entries.filter((entry) => entry.id !== this.devExtensionEntry?.id),
          this.devExtensionEntry
        ]
      : entries
    this.installedById = new Map()

    for (const entry of this.installedEntries) {
      if (!this.installedById.has(entry.id)) {
        this.installedById.set(entry.id, entry)
      }
    }

    return this.installedEntries
  }

  listEntries(): readonly ExtensionInstalledEntry[] {
    return this.installedEntries
  }

  async listPackageInfo(): Promise<ExtensionInstalledPackageInfo[]> {
    await this.refresh()
    return this.installedEntries.map((entry) =>
      toExtensionInstalledPackageInfo(entry, this.getRuntimeState(entry.id))
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

  getRuntimeState(extensionId: string): ExtensionRuntimeState | null {
    return this.runtime.getRuntimeState(requireSafeExtensionId(extensionId))
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
      this.event.bus.emit('extension:enabled', { extensionId: safeExtensionId })
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
      this.event.bus.emit('extension:disabled', { extensionId: safeExtensionId })
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
        await this.syncReloadWatcherTargets(this.runtime.getDesiredExtensions())
        await this.packageCommitter.removeActivePackage({
          operationId: randomUUID(),
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

  async reload(extensionId: string): Promise<ExtensionInstalledEntry> {
    return this.options.runMutatingOperation(async () => {
      const safeExtensionId = requireSafeExtensionId(extensionId)
      await this.reloadRuntimeLocked(safeExtensionId, 'user')
      this.assertRuntimeReady(safeExtensionId, 'reload')
      return this.require(safeExtensionId)
    })
  }

  async reloadRuntime(extensionId: string, cause: ExtensionRuntimeChangeCause): Promise<void> {
    await this.options.runMutatingOperation(async () => {
      await this.reloadRuntimeLocked(requireSafeExtensionId(extensionId), cause)
    })
  }

  async applyRuntimeState(options: {
    cause: ExtensionRuntimeChangeCause
    forceReloadIds?: Iterable<string>
  }): Promise<void> {
    const desired = this.buildDesiredRuntimeMap()
    await this.runtime.reconcile(desired, options)
    await this.syncReloadWatcherTargets(desired)
    this.options.onContributionSnapshotChanged?.()
  }

  async syncReloadWatcherTargets(
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

  private async resolveDevExtension(
    options: { logFailures?: boolean } = {}
  ): Promise<ExtensionInstalledEntry | null> {
    const logFailures = options.logFailures ?? true
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

      log.info('Registered dev extension override.', {
        parsedManifestId: parsed.manifest.id,
        extensionPath: extensionPath
      })

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
        includePreviewUpdates: null,
        installedAt: null,
        updatedAt: null,
        packagePath: extensionPath,
        manifestPath,
        dataPath,
        tempPath
      }
    } catch (error) {
      if (logFailures) {
        log.error('Failed to load --dev-extension package:', error)
      }
      return null
    }
  }

  private async reloadRuntimeLocked(
    extensionId: string,
    cause: ExtensionRuntimeChangeCause
  ): Promise<void> {
    const shouldApplyRuntimeState = await this.refreshForRuntimeReload(extensionId, cause)
    if (!shouldApplyRuntimeState) {
      return
    }

    await this.applyRuntimeState({
      cause,
      forceReloadIds: [extensionId]
    })
  }

  private async refreshForRuntimeReload(
    extensionId: string,
    cause: ExtensionRuntimeChangeCause
  ): Promise<boolean> {
    if (cause !== 'file-change') {
      this.devExtensionEntry = await this.resolveDevExtension()
      await this.refresh()
      return true
    }

    return this.refreshUntilReloadTargetReady(extensionId)
  }

  private async refreshUntilReloadTargetReady(extensionId: string): Promise<boolean> {
    const previousDevExtensionEntry = this.devExtensionEntry
    const previousInstalledEntries = this.installedEntries
    const previousInstalledById = this.installedById
    let lastEntry: ExtensionInstalledEntry | undefined

    for (let attempt = 1; attempt <= FILE_CHANGE_RELOAD_READY_ATTEMPTS; attempt += 1) {
      this.devExtensionEntry = await this.resolveDevExtension({
        logFailures: attempt === FILE_CHANGE_RELOAD_READY_ATTEMPTS
      })
      await this.refresh()

      lastEntry = this.installedById.get(extensionId)
      if (isRuntimeReadyEntry(lastEntry)) {
        if (attempt > 1) {
          log.info('Extension package became ready after file-change wait.', {
            extensionId: extensionId,
            attempt: attempt
          })
        }
        return true
      }

      if (attempt < FILE_CHANGE_RELOAD_READY_ATTEMPTS) {
        await delay(FILE_CHANGE_RELOAD_READY_DELAY_MS)
      }
    }

    log.warn('Extension package was not ready after file-change wait.', {
      extensionId: extensionId,
      entryStatus: lastEntry?.status ?? 'missing',
      issueCount: lastEntry?.issues.length ?? 0
    })
    this.devExtensionEntry = previousDevExtensionEntry
    this.installedEntries = previousInstalledEntries
    this.installedById = previousInstalledById
    return false
  }

  private buildDesiredRuntimeMap(): Map<string, ExtensionRuntimeMetadata> {
    const desired = new Map<string, ExtensionRuntimeMetadata>()

    for (const entry of this.installedEntries) {
      if (!entry.enabled || entry.status !== 'ready' || !entry.manifest) {
        continue
      }

      desired.set(entry.id, this.createInstalledRuntimeMetadata(entry))
    }

    if (this.devExtensionEntry?.manifest) {
      desired.set(
        this.devExtensionEntry.id,
        createExtensionRuntimeMetadata(this.devExtensionEntry, { mode: 'development' })
      )
    }

    return desired
  }

  private createInstalledRuntimeMetadata(entry: ExtensionInstalledEntry): ExtensionRuntimeMetadata {
    return createExtensionRuntimeMetadata(entry, {
      mode: entry.builtin && !app.isPackaged ? 'development' : 'production'
    })
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
  runtimeState: ExtensionRuntimeState | null
): ExtensionInstalledPackageInfo {
  const runtimeStatus =
    entry.enabled && entry.status === 'ready' ? (runtimeState?.status ?? 'stopped') : 'stopped'
  const runtimeError = runtimeStatus === 'failed' ? (runtimeState?.error ?? null) : null
  const runtimeDiagnostics =
    entry.enabled && entry.status === 'ready' ? (runtimeState?.diagnostics ?? []) : []

  return {
    builtin: entry.builtin,
    id: entry.id,
    name: entry.manifest?.name ?? entry.id,
    version: entry.version,
    description: entry.manifest?.description,
    author: entry.manifest?.author,
    homepage: entry.manifest?.homepage,
    iconUrl: entry.manifest?.icon
      ? pathToFileURL(resolveExtensionFilePath(entry.packagePath, entry.manifest.icon)).toString()
      : undefined,
    categories: entry.categories,
    enabled: entry.enabled,
    status: entry.status,
    runtimeStatus,
    runtimeError,
    runtimeDiagnostics,
    installationSource: entry.source,
    updatePolicy: entry.updatePolicy ?? undefined,
    pinnedVersion: entry.pinnedVersion,
    includePreviewUpdates: entry.includePreviewUpdates,
    installedAt: entry.installedAt,
    directory: entry.packagePath,
    issues: entry.issues
  }
}

function isRuntimeReadyEntry(
  entry: ExtensionInstalledEntry | undefined
): entry is ExtensionInstalledEntry {
  return Boolean(entry?.enabled && entry.status === 'ready' && entry.manifest)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
