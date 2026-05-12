import type {
  ExtensionCategory,
  ExtensionManifest,
  ExtensionMode,
  ExtensionRuntimeMetadata,
  ValidationIssue
} from '@kisaki/extension-api'
import type { ExtensionInstallUpdatePolicy } from '@shared/extension'
import type { ExtensionInstallationSource } from '@shared/extension/installation-source'

export interface ExtensionServicePaths {
  rootDir: string
  packagesDir: string
  builtinPackagesDir: string
  dataDir: string
  tempDir: string
}

export interface ExtensionSourceLocator {
  provider: string
  locator: string
}

export interface ExtensionStateRecord {
  enabled: boolean
  version: string
  source: ExtensionSourceLocator | null
  installedAt: string
  updatedAt: string
}

export interface ExtensionStateDocument {
  version: 1
  extensions: Record<string, ExtensionStateRecord>
}

export interface ScannedExtensionPackage {
  builtin: boolean
  id: string
  directoryName: string
  packagePath: string
  manifestPath: string
  manifest: ExtensionManifest | null
  issues: readonly ValidationIssue[]
}

export type ExtensionCatalogStatus = 'ready' | 'invalid' | 'missing-package' | 'orphaned'

export interface ExtensionCatalogEntry {
  builtin: boolean
  id: string
  directoryName: string
  status: ExtensionCatalogStatus
  manifest: ExtensionManifest | null
  issues: readonly string[]
  enabled: boolean
  version: string | null
  categories: readonly ExtensionCategory[]
  source: ExtensionInstallationSource | ExtensionSourceLocator | null
  updatePolicy: ExtensionInstallUpdatePolicy | null
  pinnedVersion: string | null
  channel: string | null
  installedAt: string | null
  updatedAt: string | null
  packagePath: string
  manifestPath: string
  dataPath: string
  tempPath: string
}

export interface ExtensionDiscoveryEntry {
  id: string
  name: string
  version: string | null
  description?: string
  author?: string
  homepage?: string
  categories?: readonly ExtensionCategory[]
  provider: string
  locator: string
  iconUrl?: string
  stars?: number
  updatedAt?: string
}

export interface ExtensionSourceEntry extends ExtensionDiscoveryEntry {
  version: string
  downloadUrl: string
}

export interface ExtensionSearchOptions {
  page?: number
  limit?: number
  sortBy?: 'stars' | 'updated' | 'name'
  sortDirection?: 'asc' | 'desc'
}

export interface ExtensionSearchResult {
  entries: readonly ExtensionDiscoveryEntry[]
  total: number
  hasMore: boolean
}

export interface ExtensionSourceProviderInfo {
  name: string
  displayName: string
  searchable: boolean
}

export interface ExtensionSourceProvider {
  readonly name: string
  readonly displayName: string
  readonly searchable: boolean
  search(query: string, options?: ExtensionSearchOptions): Promise<ExtensionSearchResult>
  resolve(source: string): Promise<ExtensionSourceEntry | null>
  getLatestVersion(extensionId: string, source: string): Promise<string | null>
  download(entry: ExtensionSourceEntry): Promise<string>
}

export interface ExtensionInstallResult {
  extensionId: string
  packagePath: string
  manifest: ExtensionManifest
  commit?(): Promise<void>
  rollback?(): Promise<void>
}

export interface CreateRuntimeMetadataOptions {
  mode?: ExtensionMode
}

export function createExtensionRuntimeMetadata(
  entry: ExtensionCatalogEntry,
  options: CreateRuntimeMetadataOptions = {}
): ExtensionRuntimeMetadata {
  if (!entry.manifest) {
    throw new Error(`Extension "${entry.id}" does not have a valid manifest`)
  }

  return {
    id: entry.manifest.id,
    name: entry.manifest.name,
    version: entry.manifest.version,
    manifestPath: entry.manifestPath,
    extensionPath: entry.packagePath,
    dataPath: entry.dataPath,
    tempPath: entry.tempPath,
    mode: options.mode ?? 'production'
  }
}
