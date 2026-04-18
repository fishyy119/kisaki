import path from 'node:path'
import fse from 'fs-extra'
import log from 'electron-log/main'
import type { ValidationIssue } from '@kisaki/extension-api'
import { readExtensionManifestFile, validateInstalledExtensionPackage } from './manifest'
import type {
  ExtensionCatalogEntry,
  ExtensionServicePaths,
  ExtensionStateRecord,
  ScannedExtensionPackage
} from './types'
import type { ExtensionStateStore } from './state'

/**
 * Aggregates installed extension packages with persisted state.json metadata.
 */
export class ExtensionCatalog {
  private snapshot: readonly ExtensionCatalogEntry[] = []
  private byId = new Map<string, ExtensionCatalogEntry>()

  constructor(
    private readonly paths: ExtensionServicePaths,
    private readonly stateStore: ExtensionStateStore
  ) {}

  async refresh(): Promise<readonly ExtensionCatalogEntry[]> {
    await Promise.all([
      fse.ensureDir(this.paths.packagesDir),
      fse.ensureDir(this.paths.dataDir),
      fse.ensureDir(this.paths.tempDir)
    ])

    const installedState = await this.stateStore.list()
    const scannedPackages = await this.scanPackages()

    const nextEntries = new Map<string, ExtensionCatalogEntry>()
    const linkedPackageIds = new Set<string>()

    for (const [extensionId, record] of Object.entries(installedState)) {
      const packageRecord = findPackageRecord(scannedPackages, extensionId)
      if (packageRecord) {
        linkedPackageIds.add(packageRecord.directoryName)
      }

      nextEntries.set(
        extensionId,
        buildCatalogEntry(this.paths, extensionId, record, packageRecord)
      )
    }

    for (const packageRecord of scannedPackages) {
      if (linkedPackageIds.has(packageRecord.directoryName)) {
        continue
      }

      const orphanedEntry = buildCatalogEntry(this.paths, packageRecord.id, null, packageRecord)
      nextEntries.set(createOrphanedMapKey(packageRecord), orphanedEntry)
    }

    const sortedEntries = [...nextEntries.values()].sort(compareCatalogEntries)
    this.snapshot = sortedEntries
    this.byId = new Map()

    for (const entry of sortedEntries) {
      if (!this.byId.has(entry.id)) {
        this.byId.set(entry.id, entry)
      }
    }

    return sortedEntries
  }

  list(): readonly ExtensionCatalogEntry[] {
    return this.snapshot
  }

  get(extensionId: string): ExtensionCatalogEntry | undefined {
    return this.byId.get(extensionId)
  }

  private async scanPackages(): Promise<readonly ScannedExtensionPackage[]> {
    const entries = await fse.readdir(this.paths.packagesDir, { withFileTypes: true })
    const packages: ScannedExtensionPackage[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      const directoryName = entry.name
      const packagePath = path.join(this.paths.packagesDir, directoryName)
      const manifestPath = path.join(packagePath, 'manifest.json')

      if (!(await fse.pathExists(manifestPath))) {
        packages.push({
          id: directoryName,
          directoryName,
          packagePath,
          manifestPath,
          manifest: null,
          issues: [
            {
              path: '$',
              message: 'Installed package is missing manifest.json.'
            }
          ]
        })
        continue
      }

      try {
        const parsed = await readExtensionManifestFile(manifestPath)
        const issues = [...parsed.issues]

        if (parsed.manifest) {
          issues.push(...(await validateInstalledExtensionPackage(packagePath, parsed.manifest)))
        }

        if (parsed.manifest && parsed.manifest.id !== directoryName) {
          issues.push({
            path: '$.id',
            message: 'Installed package directory must match manifest id.'
          })
        }

        packages.push({
          id: parsed.manifest?.id ?? directoryName,
          directoryName,
          packagePath,
          manifestPath,
          manifest: parsed.manifest,
          issues
        })
      } catch (error) {
        log.warn(
          `[ExtensionCatalog] Failed to parse manifest for package "${directoryName}":`,
          error
        )
        packages.push({
          id: directoryName,
          directoryName,
          packagePath,
          manifestPath,
          manifest: null,
          issues: [
            {
              path: '$',
              message: 'manifest.json could not be read.'
            }
          ]
        })
      }
    }

    return packages
  }
}

function buildCatalogEntry(
  paths: ExtensionServicePaths,
  extensionId: string,
  state: ExtensionStateRecord | null,
  pkg: ScannedExtensionPackage | null
): ExtensionCatalogEntry {
  const packagePath = pkg?.packagePath ?? path.join(paths.packagesDir, extensionId)
  const manifestPath = pkg?.manifestPath ?? path.join(packagePath, 'manifest.json')
  const dataPath = path.join(paths.dataDir, extensionId)
  const tempPath = path.join(paths.tempDir, extensionId)

  if (!pkg) {
    return {
      id: extensionId,
      directoryName: extensionId,
      status: 'missing-package',
      manifest: null,
      issues: ['$: Installed package directory is missing.'],
      enabled: state?.enabled ?? false,
      version: state?.version ?? null,
      categories: [],
      source: state?.source ?? null,
      installedAt: state?.installedAt ?? null,
      updatedAt: state?.updatedAt ?? null,
      packagePath,
      manifestPath,
      dataPath,
      tempPath
    }
  }

  const hasIssues = pkg.issues.length > 0
  const status = state ? (hasIssues ? 'invalid' : 'ready') : 'orphaned'
  const manifest = pkg.manifest

  return {
    id: extensionId,
    directoryName: pkg.directoryName,
    status,
    manifest,
    issues: pkg.issues.map(formatIssue),
    enabled: state?.enabled ?? false,
    version: state?.version ?? manifest?.version ?? null,
    categories: manifest?.categories ?? [],
    source: state?.source ?? null,
    installedAt: state?.installedAt ?? null,
    updatedAt: state?.updatedAt ?? null,
    packagePath,
    manifestPath,
    dataPath,
    tempPath
  }
}

function compareCatalogEntries(left: ExtensionCatalogEntry, right: ExtensionCatalogEntry): number {
  const statusWeight = getStatusWeight(left.status) - getStatusWeight(right.status)
  if (statusWeight !== 0) {
    return statusWeight
  }

  const leftName = left.manifest?.name ?? left.id
  const rightName = right.manifest?.name ?? right.id
  return leftName.localeCompare(rightName, 'en')
}

function getStatusWeight(status: ExtensionCatalogEntry['status']): number {
  switch (status) {
    case 'ready':
      return 0
    case 'invalid':
      return 1
    case 'missing-package':
      return 2
    case 'orphaned':
      return 3
  }
}

function findPackageRecord(
  packages: readonly ScannedExtensionPackage[],
  extensionId: string
): ScannedExtensionPackage | null {
  for (const packageRecord of packages) {
    if (packageRecord.directoryName === extensionId || packageRecord.id === extensionId) {
      return packageRecord
    }
  }

  return null
}

function createOrphanedMapKey(pkg: ScannedExtensionPackage): string {
  return pkg.id === pkg.directoryName ? pkg.id : `${pkg.id}::${pkg.directoryName}`
}

function formatIssue(issue: ValidationIssue): string {
  return `${issue.path}: ${issue.message}`
}
