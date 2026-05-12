import fse from 'fs-extra'
import log from 'electron-log/main'
import type { ValidationIssue } from '@kisaki/extension-api'
import type { ExtensionInstallationRow } from '@shared/db'
import { readExtensionManifestFile, validateInstalledExtensionPackage } from '../packages/manifest'
import type { ExtensionPackageLayout } from '../packages/layout'
import type { ExtensionCatalogEntry, ScannedExtensionPackage } from '../types'
import { resolveInsideRoot } from '../shared/path-confinement'
import type { ExtensionInstallationStore } from './store'

/**
 * Builds the installed-extension view from SQLite installation facts and
 * package manifests. Filesystem state is diagnostic; DB rows decide whether a
 * user-managed extension is installed.
 */
export class ExtensionInstallationCatalog {
  private snapshot: readonly ExtensionCatalogEntry[] = []
  private byId = new Map<string, ExtensionCatalogEntry>()

  constructor(
    private readonly layout: ExtensionPackageLayout,
    private readonly installationStore: ExtensionInstallationStore
  ) {}

  async refresh(): Promise<readonly ExtensionCatalogEntry[]> {
    await this.layout.ensureBaseDirectories()

    const installations = this.installationStore.list()
    const [builtinPackages, installedPackages] = await Promise.all([
      this.scanPackages(this.layout.builtinPackagesDir, true),
      this.scanPackages(this.layout.packagesDir, false)
    ])

    const nextEntries = new Map<string, ExtensionCatalogEntry>()
    const linkedPackageIds = new Set<string>()
    const builtinIds = new Set<string>()

    for (const packageRecord of builtinPackages) {
      const builtinEntry = buildCatalogEntry(this.layout, packageRecord.id, null, packageRecord)
      nextEntries.set(packageRecord.id, builtinEntry)
      builtinIds.add(packageRecord.id)
    }

    for (const installation of installations) {
      if (builtinIds.has(installation.id)) {
        continue
      }

      const packageRecord = findPackageRecord(installedPackages, installation.id)
      if (packageRecord) {
        linkedPackageIds.add(packageRecord.directoryName)
      }

      nextEntries.set(
        installation.id,
        buildCatalogEntry(this.layout, installation.id, installation, packageRecord)
      )
    }

    for (const packageRecord of installedPackages) {
      if (linkedPackageIds.has(packageRecord.directoryName)) {
        continue
      }

      if (builtinIds.has(packageRecord.id) || builtinIds.has(packageRecord.directoryName)) {
        continue
      }

      const orphanedEntry = buildCatalogEntry(this.layout, packageRecord.id, null, packageRecord)
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
          issues: [{ path: '$', message: 'Installed package is missing manifest.json.' }]
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
          `[ExtensionInstallationCatalog] Failed to parse manifest for package "${directoryName}":`,
          error
        )
        packages.push({
          builtin,
          id: directoryName,
          directoryName,
          packagePath,
          manifestPath,
          manifest: null,
          issues: [{ path: '$', message: 'manifest.json could not be read.' }]
        })
      }
    }

    return packages
  }
}

function buildCatalogEntry(
  layout: ExtensionPackageLayout,
  extensionId: string,
  installation: ExtensionInstallationRow | null,
  pkg: ScannedExtensionPackage | null
): ExtensionCatalogEntry {
  const builtin = pkg?.builtin ?? false
  const packagePath = pkg?.packagePath ?? layout.packageDir(extensionId)
  const manifestPath = pkg?.manifestPath ?? layout.packageManifestPath(extensionId)
  const dataPath = layout.dataPath(extensionId)
  const tempPath = layout.runtimeTempPath(extensionId)

  if (!pkg) {
    return {
      builtin,
      id: extensionId,
      directoryName: extensionId,
      status: 'missing-package',
      manifest: null,
      issues: ['$: Installed package directory is missing.'],
      enabled: installation?.enabled ?? false,
      version: installation?.version ?? null,
      categories: [],
      source: installation?.source ?? null,
      installedAt: toIsoString(installation?.installedAt),
      updatedAt: toIsoString(installation?.updatedAt),
      packagePath,
      manifestPath,
      dataPath,
      tempPath
    }
  }

  const issues = [...pkg.issues]
  if (installation && pkg.manifest && pkg.manifest.version !== installation.version) {
    issues.push({
      path: '$.version',
      message: `Installed package version "${pkg.manifest.version}" does not match DB version "${installation.version}".`
    })
  }

  if (installation && installation.source === null) {
    issues.push({
      path: '$.source',
      message: 'Installation source is invalid.'
    })
  }

  const hasIssues = issues.length > 0
  const status = getPackageCatalogStatus({ builtin, hasIssues, registered: installation !== null })
  const manifest = pkg.manifest

  return {
    builtin,
    id: extensionId,
    directoryName: pkg.directoryName,
    status,
    manifest,
    issues: issues.map(formatIssue),
    enabled: builtin ? !hasIssues : (installation?.enabled ?? false),
    version: installation?.version ?? manifest?.version ?? null,
    categories: manifest?.categories ?? [],
    source: installation?.source ?? null,
    installedAt: toIsoString(installation?.installedAt),
    updatedAt: toIsoString(installation?.updatedAt),
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

function toIsoString(value: Date | number | string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}
