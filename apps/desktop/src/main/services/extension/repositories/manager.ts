import { createLogger } from '@main/log'
import type {
  ExtensionCreateRepositoryReleasePlanRequest,
  ExtensionCatalogSearchRequest,
  ExtensionCatalogSearchResult,
  ExtensionRepositoryCreateRequest,
  ExtensionRepositoryInfo,
  ExtensionRepositoryRefreshResult,
  ExtensionRepositoryUpdateRequest
} from '@shared/extension'
import type { TaskRunInitiator, TaskRunStartResult } from '@shared/task-run'
import type { ExtensionRepositoryRow } from '@shared/db'
import type { I18nService } from '@main/services/i18n'
import type { TaskRunService } from '@main/services/task-run'
import type {
  ExtensionRegistryManifest,
  ExtensionRegistryReleaseKind
} from '@kisaki3/extension-registry'
import type { ExtensionIconManager } from '../packages'
import { ExtensionRepositoryAggregator } from './aggregate'
import { ExtensionRepositoryFetcher } from './fetcher'
import { ExtensionRepositoryStore } from './store'
import type {
  ExtensionRepositoryCatalog,
  ExtensionRepositoryInstallCandidate,
  ExtensionRepositorySearchContext
} from './types'
import { getRegistryManifestUrlPolicyIssues } from './url-policy'
import {
  normalizeManifestUrl,
  normalizeOptionalName,
  normalizePriority,
  normalizeRepositoryState,
  requireNonEmptyString
} from './normalization'
import { collectCatalogIcons, toRepositoryInfo as toRepositoryInfoDto } from './projection'
import { ExtensionRepositoryRefreshRunner, type ExtensionRepositoryRefreshOptions } from './refresh'
import { collectInstallCandidates, compareInstallCandidates } from './selection'

const log = createLogger('Extension')

export interface ExtensionRepositoryManagerOptions {
  store: ExtensionRepositoryStore
  fetcher: ExtensionRepositoryFetcher
  iconManager: ExtensionIconManager
  taskRun: TaskRunService
  i18n: I18nService
  apiVersion: string
  allowInsecureLocalUrls?: boolean
  getInstalledVersions?: () => ReadonlyMap<string, string>
  onRepositoriesChanged?: () => void
  onCatalogChanged?: () => void
}

export class ExtensionRepositoryManager {
  private readonly store: ExtensionRepositoryStore
  private readonly fetcher: ExtensionRepositoryFetcher
  private readonly iconManager: ExtensionIconManager
  private readonly refreshRunner: ExtensionRepositoryRefreshRunner
  private readonly aggregator: ExtensionRepositoryAggregator
  private readonly apiVersion: string
  private readonly allowInsecureLocalUrls: boolean
  private readonly getInstalledVersions?: () => ReadonlyMap<string, string>
  private readonly warnedDisallowedSnapshots = new Set<string>()
  private readonly onRepositoriesChanged?: () => void
  private readonly onCatalogChanged?: () => void
  private catalog: ExtensionRepositoryCatalog = {
    packages: [],
    updatedAt: new Date(0).toISOString()
  }

  constructor(options: ExtensionRepositoryManagerOptions) {
    this.store = options.store
    this.fetcher = options.fetcher
    this.iconManager = options.iconManager
    this.apiVersion = options.apiVersion
    this.allowInsecureLocalUrls = options.allowInsecureLocalUrls ?? false
    this.getInstalledVersions = options.getInstalledVersions
    this.onRepositoriesChanged = options.onRepositoriesChanged
    this.onCatalogChanged = options.onCatalogChanged
    this.aggregator = new ExtensionRepositoryAggregator({
      apiVersion: options.apiVersion,
      resolveIconUrl: (icon) => this.iconManager.getIconUrl(icon)
    })
    this.refreshRunner = new ExtensionRepositoryRefreshRunner({
      taskRun: options.taskRun,
      store: this.store,
      i18n: options.i18n,
      refreshRepository: (repositoryId, refreshOptions) =>
        this.refreshRepository(repositoryId, refreshOptions)
    })
  }

  async init(): Promise<void> {
    this.discardInvalidManifestSnapshots()
    this.store.normalizePriorities()
    this.rebuildCatalog()
  }

  /**
   * A persisted snapshot that fails to parse under the current registry schema is
   * read back as null while its digest survives. Surface that as a repository
   * error and drop the stale cache validators so the next refresh refetches.
   */
  private discardInvalidManifestSnapshots(): void {
    for (const row of this.store.list()) {
      if (!row.manifestDigest || row.manifestSnapshot) {
        continue
      }

      this.store.discardInvalidManifestSnapshot(row.id, {
        error:
          'Stored repository manifest snapshot is no longer valid for this app version. Refresh the repository.'
      })
      log.warn('Discarded a persisted repository manifest snapshot that no longer parses.', {
        repositoryId: row.id
      })
    }
  }

  listRepositories(): readonly ExtensionRepositoryInfo[] {
    return this.store.list().map((row) => this.toRepositoryInfo(row))
  }

  async addRepository(request: ExtensionRepositoryCreateRequest): Promise<ExtensionRepositoryInfo> {
    const url = normalizeManifestUrl(request.url, {
      allowInsecureLocalUrls: this.allowInsecureLocalUrls
    })
    const existing = this.store.getByUrl(url)
    if (existing) {
      throw new Error(`Extension repository URL is already registered as "${existing.id}".`)
    }

    const fetched = await this.fetcher.fetch(url)
    if (fetched.status !== 'success') {
      throw new Error('Repository returned not-modified before it had a local snapshot.')
    }

    const id = this.createAvailableRepositoryId(fetched.manifest.id)
    this.store.create({
      id,
      url,
      name: normalizeOptionalName(request.name) ?? fetched.manifest.name,
      state: normalizeRepositoryState(request.state) ?? 'enabled',
      priority: normalizePriority(request.priority) ?? this.store.nextPriority()
    })
    const row = this.store.recordRefreshSuccess(id, {
      manifestSnapshot: fetched.manifest,
      manifestDigest: fetched.manifestDigest,
      etag: fetched.etag,
      lastModified: fetched.lastModified
    })

    this.rebuildCatalogAndEmit()
    return this.toRepositoryInfo(row)
  }

  async updateRepository(
    request: ExtensionRepositoryUpdateRequest
  ): Promise<ExtensionRepositoryInfo> {
    const id = requireNonEmptyString(request.id, 'repository id')
    const existing = this.store.require(id)
    const patch: Parameters<ExtensionRepositoryStore['update']>[1] = {}
    const requestedPriority =
      request.priority === undefined ? undefined : normalizePriority(request.priority)

    if (request.url !== undefined) {
      const url = normalizeManifestUrl(request.url, {
        allowInsecureLocalUrls: this.allowInsecureLocalUrls
      })
      const duplicate = this.store.getByUrl(url)
      if (duplicate && duplicate.id !== id) {
        throw new Error(`Extension repository URL is already registered as "${duplicate.id}".`)
      }
      if (url !== existing.url) {
        patch.url = url
      }
    }

    if (request.name !== undefined) {
      patch.name = normalizeOptionalName(request.name) ?? existing.name
    }
    if (request.state !== undefined) {
      patch.state = normalizeRepositoryState(request.state) ?? existing.state
    }
    let row = Object.keys(patch).length > 0 ? this.store.update(id, patch) : existing
    if (requestedPriority !== undefined) {
      row = this.store.reorder(id, requestedPriority)
    }
    this.rebuildCatalogAndEmit()

    if (patch.url && row.state === 'enabled') {
      await this.refreshRepository(row.id)
      return this.toRepositoryInfo(this.store.require(row.id))
    }

    return this.toRepositoryInfo(row)
  }

  removeRepository(repositoryId: string): void {
    const row = this.store.require(requireNonEmptyString(repositoryId, 'repository id'))
    this.store.remove(row.id)
    this.store.normalizePriorities()
    this.rebuildCatalogAndEmit()
  }

  startRefreshRepository(repositoryId: string): TaskRunStartResult {
    return this.refreshRunner.startRefreshRepository(repositoryId)
  }

  startRefreshRepositories(): TaskRunStartResult {
    return this.refreshRunner.startRefreshRepositories()
  }

  runRefreshRepositories(
    initiator: TaskRunInitiator
  ): Promise<readonly ExtensionRepositoryRefreshResult[]> {
    return this.refreshRunner.runRefreshRepositories(initiator)
  }

  async refreshRepository(
    repositoryId: string,
    options: ExtensionRepositoryRefreshOptions = {}
  ): Promise<ExtensionRepositoryRefreshResult> {
    const row = this.store.require(requireNonEmptyString(repositoryId, 'repository id'))
    if (row.state !== 'enabled') {
      const updated = this.store.recordRefreshFailure(row.id, {
        error: 'Repository is disabled and cannot be refreshed.'
      })
      this.emitRepositoriesChanged()
      return {
        repository: this.toRepositoryInfo(updated),
        status: 'failed',
        changed: false,
        error: updated.lastError
      }
    }

    try {
      // Conditional headers are only valid while the local snapshot is usable
      // (readable and allowed by the URL policy); otherwise a 304 response
      // would leave the repository empty forever, so force a full refetch.
      const hasUsableSnapshot = this.getAllowedManifestSnapshot(row) !== null
      const fetched = await this.fetcher.fetch(row.url, {
        etag: hasUsableSnapshot ? row.etag : null,
        lastModified: hasUsableSnapshot ? row.lastModified : null,
        signal: options.signal
      })

      if (fetched.status === 'not-modified') {
        if (!hasUsableSnapshot) {
          throw new Error('Repository returned not-modified before it had a local snapshot.')
        }
        const updated = this.store.recordRefreshNotModified(row.id, {
          etag: fetched.etag,
          lastModified: fetched.lastModified
        })
        this.emitRepositoriesChanged()
        return {
          repository: this.toRepositoryInfo(updated),
          status: 'not-modified',
          changed: false,
          error: null
        }
      }

      const updated = this.store.recordRefreshSuccess(row.id, {
        manifestSnapshot: fetched.manifest,
        manifestDigest: fetched.manifestDigest,
        etag: fetched.etag,
        lastModified: fetched.lastModified
      })
      this.rebuildCatalogAndEmit()

      return {
        repository: this.toRepositoryInfo(updated),
        status: 'success',
        changed: true,
        error: null
      }
    } catch (error) {
      if (options.signal?.aborted) {
        throw error
      }

      const updated = this.store.recordRefreshFailure(row.id, {
        error: error instanceof Error ? error.message : 'Unknown repository refresh error'
      })
      this.emitRepositoriesChanged()
      return {
        repository: this.toRepositoryInfo(updated),
        status: 'failed',
        changed: false,
        error: updated.lastError
      }
    }
  }

  async refreshRepositories(
    options: ExtensionRepositoryRefreshOptions = {}
  ): Promise<readonly ExtensionRepositoryRefreshResult[]> {
    const results: ExtensionRepositoryRefreshResult[] = []
    for (const row of this.store.listEnabled()) {
      if (options.signal?.aborted) {
        throw new Error('Extension repository refresh was aborted.')
      }
      results.push(await this.refreshRepository(row.id, options))
    }
    return results
  }

  searchCatalog(
    request: ExtensionCatalogSearchRequest = {},
    context: ExtensionRepositorySearchContext = {}
  ): ExtensionCatalogSearchResult {
    return this.aggregator.search(this.catalog, request, {
      ...context,
      installedVersions: context.installedVersions ?? this.getInstalledVersions?.()
    })
  }

  getCatalog(): ExtensionRepositoryCatalog {
    return this.catalog
  }

  listInstallCandidates(
    extensionId: string,
    options: {
      repositoryId?: string
      releaseId?: string
      releaseKind?: ExtensionRegistryReleaseKind
      includeYanked?: boolean
      compatibleOnly?: boolean
    } = {}
  ): readonly ExtensionRepositoryInstallCandidate[] {
    const result = this.collectInstallCandidates(extensionId, options)
    return result.candidates.toSorted((left, right) =>
      compareInstallCandidates(left, right, this.apiVersion)
    )
  }

  resolveInstallCandidate(
    request: ExtensionCreateRepositoryReleasePlanRequest
  ): ExtensionRepositoryInstallCandidate {
    const result = this.collectInstallCandidates(request.extensionId, {
      repositoryId: request.repositoryId,
      releaseId: request.releaseId,
      releaseKind: request.releaseId ? undefined : 'stable',
      includeYanked: Boolean(request.releaseId),
      compatibleOnly: true
    })
    const candidates = result.candidates

    if (candidates.length > 0) {
      return candidates.toSorted((left, right) =>
        compareInstallCandidates(left, right, this.apiVersion)
      )[0]
    }

    if (!result.packageFound) {
      throw new Error(`Extension "${result.extensionId}" was not found in enabled repositories.`)
    }

    if (result.releaseId && !result.releaseFound) {
      throw new Error(
        `Release "${result.releaseId}" was not found for extension "${result.extensionId}".`
      )
    }

    throw new Error(`No compatible artifact was found for extension "${result.extensionId}".`)
  }

  private collectInstallCandidates(
    extensionIdValue: string,
    options: {
      repositoryId?: string
      releaseId?: string
      releaseKind?: ExtensionRegistryReleaseKind
      includeYanked?: boolean
      compatibleOnly?: boolean
    } = {}
  ) {
    return collectInstallCandidates(extensionIdValue, options, {
      store: this.store,
      apiVersion: this.apiVersion,
      getAllowedManifestSnapshot: (repository) => this.getAllowedManifestSnapshot(repository)
    })
  }

  private rebuildCatalogAndEmit(): void {
    this.rebuildCatalog()
    this.emitRepositoriesChanged()
    this.emitCatalogChanged()
  }

  private rebuildCatalog(): void {
    this.catalog = this.aggregator.aggregate(this.listCatalogRepositories())
    this.iconManager.setAvailableIcons('catalog', collectCatalogIcons(this.catalog))
  }

  private toRepositoryInfo(row: ExtensionRepositoryRow): ExtensionRepositoryInfo {
    return toRepositoryInfoDto(row, this.getAllowedManifestSnapshot(row))
  }

  private createAvailableRepositoryId(manifestId: string): string {
    if (!this.store.get(manifestId)) {
      return manifestId
    }

    for (let index = 2; index < 1000; index += 1) {
      const candidate = `${manifestId}-${index}`
      if (!this.store.get(candidate)) {
        return candidate
      }
    }

    throw new Error(`Could not allocate a local repository id for "${manifestId}".`)
  }

  private listCatalogRepositories(): ExtensionRepositoryRow[] {
    return this.store.listEnabled().map((repository) => ({
      ...repository,
      manifestSnapshot: this.getAllowedManifestSnapshot(repository)
    }))
  }

  private getAllowedManifestSnapshot(
    repository: ExtensionRepositoryRow
  ): ExtensionRegistryManifest | null {
    const manifest = repository.manifestSnapshot
    if (!manifest) {
      return null
    }

    const issues = getRegistryManifestUrlPolicyIssues(manifest, {
      allowInsecureLocalUrls: this.allowInsecureLocalUrls
    })
    if (issues.length === 0) {
      return manifest
    }

    if (!this.warnedDisallowedSnapshots.has(repository.id)) {
      this.warnedDisallowedSnapshots.add(repository.id)
      log.warn('Ignoring repository snapshot because it is not valid for the current URL policy.', {
        repositoryId: repository.id,
        issuesText: issues.join('; ')
      })
    }
    return null
  }

  private emitRepositoriesChanged(): void {
    this.onRepositoriesChanged?.()
  }

  private emitCatalogChanged(): void {
    this.onCatalogChanged?.()
  }
}
