import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createLogger } from '@main/log'
import semver from 'semver'
import type {
  ExtensionCreateRepositoryInstallPlanRequest,
  ExtensionCatalogSearchRequest,
  ExtensionCatalogSearchResult,
  ExtensionRepositoryCreateRequest,
  ExtensionRepositoryInfo,
  ExtensionRepositoryRefreshResult,
  ExtensionRepositoryState,
  ExtensionRepositoryUpdateRequest
} from '@shared/extension'
import type { ExtensionRepositoryRow } from '@shared/db'
import {
  getExtensionRegistryReleaseKind,
  selectExtensionRegistryArtifact,
  type ExtensionRegistryManifest,
  type ExtensionRegistryPackageIcon,
  type ExtensionRegistryRelease,
  type ExtensionRegistryReleaseKind
} from '@kisaki3/extension-registry'
import { createExtensionRegistryReleaseDigest } from '@kisaki3/extension-registry/node'
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

const log = createLogger('Extension')

export interface ExtensionRepositoryManagerOptions {
  store: ExtensionRepositoryStore
  fetcher: ExtensionRepositoryFetcher
  iconManager: ExtensionIconManager
  appVersion: string
  allowInsecureLocalUrls?: boolean
  getInstalledVersions?: () => ReadonlyMap<string, string>
  onRepositoriesChanged?: () => void
  onCatalogChanged?: () => void
}

export class ExtensionRepositoryManager {
  private readonly store: ExtensionRepositoryStore
  private readonly fetcher: ExtensionRepositoryFetcher
  private readonly iconManager: ExtensionIconManager
  private readonly aggregator: ExtensionRepositoryAggregator
  private readonly appVersion: string
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
    this.appVersion = options.appVersion
    this.allowInsecureLocalUrls = options.allowInsecureLocalUrls ?? false
    this.getInstalledVersions = options.getInstalledVersions
    this.onRepositoriesChanged = options.onRepositoriesChanged
    this.onCatalogChanged = options.onCatalogChanged
    this.aggregator = new ExtensionRepositoryAggregator({
      appVersion: options.appVersion,
      resolveIconUrl: (icon) => this.iconManager.getIconUrl(icon)
    })
  }

  async init(): Promise<void> {
    this.store.normalizePriorities()
    this.rebuildCatalog()
  }

  listRepositories(): readonly ExtensionRepositoryInfo[] {
    return this.store.list().map((row) => this.toRepositoryInfo(row))
  }

  async addRepository(request: ExtensionRepositoryCreateRequest): Promise<ExtensionRepositoryInfo> {
    const url = this.normalizeManifestUrl(request.url)
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
      const url = this.normalizeManifestUrl(request.url)
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

  async refreshRepository(repositoryId: string): Promise<ExtensionRepositoryRefreshResult> {
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
      const fetched = await this.fetcher.fetch(row.url, {
        etag: row.etag,
        lastModified: row.lastModified
      })

      if (fetched.status === 'not-modified') {
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

  async refreshRepositories(): Promise<readonly ExtensionRepositoryRefreshResult[]> {
    const results: ExtensionRepositoryRefreshResult[] = []
    for (const row of this.store.listEnabled()) {
      results.push(await this.refreshRepository(row.id))
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
      compareInstallCandidates(left, right, this.appVersion)
    )
  }

  resolveInstallCandidate(
    request: ExtensionCreateRepositoryInstallPlanRequest
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
        compareInstallCandidates(left, right, this.appVersion)
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
  ): {
    extensionId: string
    releaseId?: string
    packageFound: boolean
    releaseFound: boolean
    candidates: ExtensionRepositoryInstallCandidate[]
  } {
    const extensionId = requireNonEmptyString(extensionIdValue, 'extension id')
    const repositoryId = options.repositoryId
      ? requireNonEmptyString(options.repositoryId, 'repository id')
      : undefined
    const releaseId = options.releaseId
      ? requireNonEmptyString(options.releaseId, 'release id')
      : undefined
    const repositories = repositoryId
      ? [this.store.require(repositoryId)]
      : this.store.listEnabled()
    const candidates: ExtensionRepositoryInstallCandidate[] = []
    let packageFound = false
    let releaseFound = false

    for (const repository of repositories) {
      if (repository.state !== 'enabled') {
        continue
      }

      const manifest = this.getAllowedManifestSnapshot(repository)
      if (!manifest) {
        continue
      }

      const registryPackage = manifest.packages.find((item) => item.id === extensionId)
      if (!registryPackage) {
        continue
      }
      packageFound = true

      for (const release of registryPackage.releases) {
        const releaseDigest = createExtensionRegistryReleaseDigest(
          manifest,
          registryPackage,
          release
        )
        if (releaseId && releaseDigest !== releaseId) {
          continue
        }
        releaseFound = true
        if (
          options.releaseKind &&
          getExtensionRegistryReleaseKind(release.version) !== options.releaseKind
        ) {
          continue
        }
        if (options.compatibleOnly !== false && !isReleaseCompatible(release, this.appVersion)) {
          continue
        }
        if (!options.includeYanked && release.yanked === true) {
          continue
        }

        const artifact = selectExtensionRegistryArtifact(release)
        if (!artifact) {
          continue
        }

        candidates.push({
          repository,
          manifest,
          registryPackage,
          release,
          releaseDigest,
          artifact
        })
      }
    }

    return {
      extensionId,
      releaseId,
      packageFound,
      releaseFound,
      candidates
    }
  }

  private rebuildCatalogAndEmit(): void {
    this.rebuildCatalog()
    this.emitRepositoriesChanged()
    this.emitCatalogChanged()
  }

  private rebuildCatalog(): void {
    this.catalog = this.aggregator.aggregate(this.listCatalogRepositories())
    this.iconManager.setAvailableIcons(collectCatalogIcons(this.catalog))
  }

  private toRepositoryInfo(row: ExtensionRepositoryRow): ExtensionRepositoryInfo {
    const manifestSnapshot = this.getAllowedManifestSnapshot(row)
    return {
      id: row.id,
      url: row.url,
      name: row.name,
      state: row.state,
      priority: row.priority,
      packageCount: manifestSnapshot?.packages.length ?? 0,
      manifestDigest: row.manifestDigest,
      manifestUpdatedAt: manifestSnapshot?.updatedAt ?? null,
      lastRefreshAt: toIsoString(row.lastRefreshAt),
      lastSuccessAt: toIsoString(row.lastSuccessAt),
      lastError: row.lastError,
      etag: row.etag,
      lastModified: row.lastModified,
      createdAt: toIsoString(row.createdAt) ?? new Date(0).toISOString(),
      updatedAt: toIsoString(row.updatedAt) ?? new Date(0).toISOString()
    }
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

  private normalizeManifestUrl(value: string): string {
    const input = requireNonEmptyString(value, 'repository URL').trim()
    let url: URL

    try {
      url = new URL(input)
    } catch {
      if (!this.allowInsecureLocalUrls) {
        throw new Error('Repository URL must be a valid https URL.')
      }
      url = new URL(pathToFileURL(path.resolve(input)).toString())
    }

    if (url.protocol === 'https:') {
      return url.toString()
    }

    if (this.allowInsecureLocalUrls && isLocalDevelopmentUrl(url)) {
      return url.toString()
    }

    throw new Error('Repository URL must use https.')
  }

  private emitRepositoriesChanged(): void {
    this.onRepositoriesChanged?.()
  }

  private emitCatalogChanged(): void {
    this.onCatalogChanged?.()
  }
}

function normalizeOptionalName(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}

function normalizeRepositoryState(
  value: ExtensionRepositoryState | undefined
): ExtensionRepositoryState | undefined {
  if (value === undefined || value === 'enabled' || value === 'disabled') {
    return value
  }

  throw new Error('Repository state must be enabled or disabled.')
}

function normalizePriority(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error('Repository priority must be a safe integer.')
  }

  return value
}

function toIsoString(value: Date | number | string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`)
  }

  return value
}

function isLocalDevelopmentUrl(url: URL): boolean {
  if (url.protocol === 'file:') {
    return true
  }

  if (url.protocol !== 'http:') {
    return false
  }

  const hostname = url.hostname.toLowerCase()
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  )
}

function compareInstallCandidates(
  left: ExtensionRepositoryInstallCandidate,
  right: ExtensionRepositoryInstallCandidate,
  appVersion: string
): number {
  return (
    compareBooleans(
      isReleaseCompatible(left.release, appVersion),
      isReleaseCompatible(right.release, appVersion)
    ) ||
    compareBooleans(left.release.yanked !== true, right.release.yanked !== true) ||
    compareBooleans(
      getExtensionRegistryReleaseKind(left.release.version) === 'stable',
      getExtensionRegistryReleaseKind(right.release.version) === 'stable'
    ) ||
    semver.rcompare(left.release.version, right.release.version) ||
    compareNullableTime(right.release.publishedAt, left.release.publishedAt) ||
    compareNumbers(left.repository.priority, right.repository.priority) ||
    compareStrings(left.repository.id, right.repository.id) ||
    compareStrings(left.releaseDigest, right.releaseDigest)
  )
}

function isReleaseCompatible(
  release: Pick<ExtensionRegistryRelease, 'engines'>,
  appVersion: string
): boolean {
  return semver.satisfies(appVersion, release.engines.kisaki)
}

function compareBooleans(left: boolean, right: boolean): number {
  return left === right ? 0 : left ? -1 : 1
}

function compareNumbers(left: number, right: number): number {
  return left === right ? 0 : left < right ? -1 : 1
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right)
}

function compareNullableTime(left: string | null, right: string | null): number {
  const leftTime = left ? Date.parse(left) : 0
  const rightTime = right ? Date.parse(right) : 0
  return compareNumbers(
    Number.isFinite(leftTime) ? leftTime : 0,
    Number.isFinite(rightTime) ? rightTime : 0
  )
}

export function collectCatalogIcons(
  catalog: ExtensionRepositoryCatalog
): readonly ExtensionRegistryPackageIcon[] {
  return catalog.packages.flatMap((item) => (item.remoteIcon ? [item.remoteIcon] : []))
}
