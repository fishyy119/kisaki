import path from 'node:path'
import { pathToFileURL } from 'node:url'
import log from 'electron-log/main'
import type {
  ExtensionCatalogSearchRequest,
  ExtensionCatalogSearchResult,
  ExtensionRepositoryCreateRequest,
  ExtensionRepositoryInfo,
  ExtensionRepositoryRefreshResult,
  ExtensionRepositoryState,
  ExtensionRepositoryUpdateRequest
} from '@shared/extension'
import type { ExtensionRepositoryRow } from '@shared/db'
import type { ExtensionRegistryPackageIcon } from '@kisaki/extension-api'
import type { ExtensionIconManager } from '../packages/icon'
import { ExtensionRepositoryAggregator } from './aggregate'
import { ExtensionRepositoryFetcher } from './fetcher'
import { ExtensionRepositoryStore } from './store'
import type { ExtensionRepositoryCatalog, ExtensionRepositorySearchContext } from './types'

export const OFFICIAL_EXTENSION_REPOSITORY_ID = 'kisaki.official'
export const OFFICIAL_EXTENSION_REPOSITORY_NAME = 'Kisaki Official Extensions'
export const OFFICIAL_EXTENSION_REPOSITORY_URL = 'https://kisaki.dev/extensions/manifest.json'

export interface ExtensionRepositoryManagerOptions {
  store: ExtensionRepositoryStore
  fetcher: ExtensionRepositoryFetcher
  iconManager: ExtensionIconManager
  appVersion: string
  allowInsecureLocalUrls?: boolean
  onRepositoriesChanged?: () => void
  onCatalogChanged?: () => void
}

export class ExtensionRepositoryManager {
  private readonly store: ExtensionRepositoryStore
  private readonly fetcher: ExtensionRepositoryFetcher
  private readonly iconManager: ExtensionIconManager
  private readonly aggregator: ExtensionRepositoryAggregator
  private readonly allowInsecureLocalUrls: boolean
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
    this.allowInsecureLocalUrls = options.allowInsecureLocalUrls ?? false
    this.onRepositoriesChanged = options.onRepositoriesChanged
    this.onCatalogChanged = options.onCatalogChanged
    this.aggregator = new ExtensionRepositoryAggregator({
      appVersion: options.appVersion,
      resolveIconUrl: (icon) => this.iconManager.getIconUrl(icon)
    })
  }

  async init(): Promise<void> {
    this.ensureOfficialRepository()
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
      builtIn: false,
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

    if (request.url !== undefined) {
      if (existing.builtIn) {
        throw new Error('Built-in extension repositories cannot change URL.')
      }
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
    if (request.priority !== undefined) {
      patch.priority = normalizePriority(request.priority) ?? existing.priority
    }

    const row = this.store.update(id, patch)
    this.rebuildCatalogAndEmit()

    if (patch.url && row.state === 'enabled') {
      await this.refreshRepository(row.id)
      return this.toRepositoryInfo(this.store.require(row.id))
    }

    return this.toRepositoryInfo(row)
  }

  removeRepository(repositoryId: string): void {
    const row = this.store.require(requireNonEmptyString(repositoryId, 'repository id'))
    if (row.builtIn) {
      throw new Error('Built-in extension repositories cannot be removed.')
    }

    this.store.remove(row.id)
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

  refreshRepositoriesInBackground(): void {
    this.refreshRepositories().catch((error) => {
      log.warn('[ExtensionRepositoryManager] Background repository refresh failed:', error)
    })
  }

  searchCatalog(
    request: ExtensionCatalogSearchRequest = {},
    context: ExtensionRepositorySearchContext = {}
  ): ExtensionCatalogSearchResult {
    return this.aggregator.search(this.catalog, request, context)
  }

  getCatalog(): ExtensionRepositoryCatalog {
    return this.catalog
  }

  private ensureOfficialRepository(): void {
    const byId = this.store.get(OFFICIAL_EXTENSION_REPOSITORY_ID)
    if (byId) {
      this.store.update(byId.id, {
        ...(byId.url === OFFICIAL_EXTENSION_REPOSITORY_URL
          ? {}
          : { url: OFFICIAL_EXTENSION_REPOSITORY_URL }),
        name: byId.name || OFFICIAL_EXTENSION_REPOSITORY_NAME,
        builtIn: true,
        priority: byId.priority
      })
      return
    }

    const byUrl = this.store.getByUrl(OFFICIAL_EXTENSION_REPOSITORY_URL)
    if (byUrl) {
      this.store.update(byUrl.id, {
        name: byUrl.name || OFFICIAL_EXTENSION_REPOSITORY_NAME,
        builtIn: true,
        priority: 0
      })
      return
    }

    this.store.create({
      id: OFFICIAL_EXTENSION_REPOSITORY_ID,
      url: OFFICIAL_EXTENSION_REPOSITORY_URL,
      name: OFFICIAL_EXTENSION_REPOSITORY_NAME,
      state: 'enabled',
      builtIn: true,
      priority: 0
    })
  }

  private rebuildCatalogAndEmit(): void {
    this.rebuildCatalog()
    this.emitRepositoriesChanged()
    this.emitCatalogChanged()
  }

  private rebuildCatalog(): void {
    this.catalog = this.aggregator.aggregate(this.store.listEnabled())
    this.iconManager.setAvailableIcons(collectCatalogIcons(this.catalog))
  }

  private toRepositoryInfo(row: ExtensionRepositoryRow): ExtensionRepositoryInfo {
    return {
      id: row.id,
      url: row.url,
      name: row.name,
      state: row.state,
      builtIn: row.builtIn,
      priority: row.priority,
      packageCount: row.manifestSnapshot?.packages.length ?? 0,
      manifestDigest: row.manifestDigest,
      manifestUpdatedAt: row.manifestSnapshot?.updatedAt ?? null,
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

export function collectCatalogIcons(
  catalog: ExtensionRepositoryCatalog
): readonly ExtensionRegistryPackageIcon[] {
  return catalog.packages.flatMap((item) => (item.remoteIcon ? [item.remoteIcon] : []))
}
