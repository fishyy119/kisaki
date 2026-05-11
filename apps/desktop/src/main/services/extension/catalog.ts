import fse from 'fs-extra'
import log from 'electron-log/main'
import type { ValidationIssue } from '@kisaki/extension-api'
import { readExtensionManifestFile, validateInstalledExtensionPackage } from './packages/manifest'
import type {
  ExtensionCatalogEntry,
  ExtensionServicePaths,
  ExtensionStateRecord,
  ScannedExtensionPackage
} from './types'
import type { ExtensionStateStore } from './state'
import { resolveInsideRoot } from './shared/path-confinement'

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
    const [builtinPackages, installedPackages] = await Promise.all([
      this.scanPackages(this.paths.builtinPackagesDir, true),
      this.scanPackages(this.paths.packagesDir, false)
    ])

    const nextEntries = new Map<string, ExtensionCatalogEntry>()
    const linkedPackageIds = new Set<string>()
    const builtinIds = new Set<string>()

    for (const packageRecord of builtinPackages) {
      const builtinEntry = buildCatalogEntry(this.paths, packageRecord.id, null, packageRecord)
      nextEntries.set(packageRecord.id, builtinEntry)
      builtinIds.add(packageRecord.id)
    }

    for (const [extensionId, record] of Object.entries(installedState)) {
      if (builtinIds.has(extensionId)) {
        continue
      }

      const packageRecord = findPackageRecord(installedPackages, extensionId)
      if (packageRecord) {
        linkedPackageIds.add(packageRecord.directoryName)
      }

      nextEntries.set(
        extensionId,
        buildCatalogEntry(this.paths, extensionId, record, packageRecord)
      )
    }

    for (const packageRecord of installedPackages) {
      if (linkedPackageIds.has(packageRecord.directoryName)) {
        continue
      }

      if (builtinIds.has(packageRecord.id) || builtinIds.has(packageRecord.directoryName)) {
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

  private async scanPackages(
    rootDir: string,
    builtin: boolean
  ): Promise<readonly ScannedExtensionPackage[]> {
    if (!(await fse.pathExists(rootDir))) {
      return []
    }

    const entries = await fse.readdir(rootDir, { withFileTypes: true })
    const packages: ScannedExtensionPackage[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      const directoryName = entry.name
      const packagePath = resolveInsideRoot(rootDir, directoryName)
      const manifestPath = resolveInsideRoot(packagePath, 'manifest.json')

      if (!(await fse.pathExists(manifestPath))) {
        packages.push({
          builtin,
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
          builtin,
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
          builtin,
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
  const builtin = pkg?.builtin ?? false
  const packagePath = pkg?.packagePath ?? resolveInsideRoot(paths.packagesDir, extensionId)
  const manifestPath = pkg?.manifestPath ?? resolveInsideRoot(packagePath, 'manifest.json')
  const dataPath = resolveInsideRoot(paths.dataDir, extensionId)
  const tempPath = resolveInsideRoot(paths.tempDir, extensionId)

  if (!pkg) {
    return {
      builtin,
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
  const status = getPackageCatalogStatus({ builtin, hasIssues, registered: state !== null })
  const manifest = pkg.manifest

  return {
    builtin,
    id: extensionId,
    directoryName: pkg.directoryName,
    status,
    manifest,
    issues: pkg.issues.map(formatIssue),
    enabled: builtin ? !hasIssues : (state?.enabled ?? false),
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

function getPackageCatalogStatus(options: {
  builtin: boolean
  hasIssues: boolean
  registered: boolean
}): ExtensionCatalogEntry['status'] {
  if (options.builtin) {
    return options.hasIssues ? 'invalid' : 'ready'
  }

  if (!options.registered) {
    return 'orphaned'
  }

  return options.hasIssues ? 'invalid' : 'ready'
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
