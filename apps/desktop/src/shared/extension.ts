import type { ExtensionCategory } from '@kisaki/extension-api'

export type InstalledExtensionStatus = 'ready' | 'invalid' | 'missing-package' | 'orphaned'

export interface ExtensionSourceReference {
  provider: string
  locator: string
}

export interface ExtensionCatalogInfo {
  id: string
  name: string
  version: string | null
  description?: string
  author?: string
  homepage?: string
  categories: readonly ExtensionCategory[]
  enabled: boolean
  status: InstalledExtensionStatus
  source: ExtensionSourceReference | null
  directory: string
  issues: readonly string[]
}

export interface ExtensionRegistryEntry {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  homepage?: string
  categories?: readonly ExtensionCategory[]
  downloadUrl: string
  provider: string
  locator: string
  iconUrl?: string
  stars?: number
  updatedAt?: string
}

export interface ExtensionUpdateInfo {
  extensionId: string
  currentVersion: string
  latestVersion: string
  source: ExtensionSourceReference | null
}
