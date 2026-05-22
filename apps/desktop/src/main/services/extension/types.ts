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

export interface ScannedExtensionPackage {
  builtin: boolean
  id: string
  directoryName: string
  packagePath: string
  manifestPath: string
  manifest: ExtensionManifest | null
  issues: readonly ValidationIssue[]
}

export type ExtensionInstalledEntryStatus = 'ready' | 'invalid' | 'missing-package'

export interface ExtensionInstalledEntry {
  builtin: boolean
  id: string
  directoryName: string
  status: ExtensionInstalledEntryStatus
  manifest: ExtensionManifest | null
  issues: readonly string[]
  enabled: boolean
  version: string | null
  categories: readonly ExtensionCategory[]
  source: ExtensionInstallationSource | null
  updatePolicy: ExtensionInstallUpdatePolicy | null
  pinnedVersion: string | null
  includePreviewUpdates: boolean | null
  installedAt: string | null
  updatedAt: string | null
  packagePath: string
  manifestPath: string
  dataPath: string
  tempPath: string
}

export interface CreateRuntimeMetadataOptions {
  mode?: ExtensionMode
}

export function createExtensionRuntimeMetadata(
  entry: ExtensionInstalledEntry,
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
