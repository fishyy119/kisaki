import fse from 'fs-extra'
import log from 'electron-log/main'
import type { ValidationIssue } from '@kisaki/extension-api'
import type { ExtensionInstallationRow } from '@shared/db'
import { readExtensionManifestFile, validateInstalledExtensionPackage } from '../packages/manifest'
import type { ExtensionPackageLayout } from '../packages/layout'
import type { ExtensionInstalledEntry, ScannedExtensionPackage } from '../types'
import { resolveInsideRoot } from '../shared/path-confinement'
import type { ExtensionInstallationStore } from './store'

/**
 * Builds the installed-extension view from built-in packages and SQLite
 * installation facts. Filesystem state is diagnostic; DB rows decide whether a
 * user-managed extension exists in the installed view.
 */
export class ExtensionInstallationView {
  private entries: readonly ExtensionInstalledEntry[] = []
  private byId = new Map<string, ExtensionInstalledEntry>()

  constructor(
    private readonly layout: ExtensionPackageLayout,
    private readonly installationStore: ExtensionInstallationStore
  ) {}

  async refresh(): Promise<readonly ExtensionInstalledEntry[]> {
    await this.layout.ensureBaseDirectories()

    const installations = this.installationStore.list()
    const [builtinPackages, installedPackages] = await Promise.all([
      this.scanPackages(this.layout.builtinPackagesDir, true),
      this.scanPackages(this.layout.packagesDir, false)
    ])

    const nextEntries = new Map<string, ExtensionInstalledEntry>()
    const builtinIds = new Set<string>()

    for (const packageRecord of builtinPackages) {
      const builtinEntry = buildInstalledEntry(this.layout, packageRecord.id, null, packageRecord)
      nextEntries.set(packageRecord.id, builtinEntry)
      builtinIds.add(packageRecord.id)
    }

    for (const installation of installations) {
      if (builtinIds.has(installation.id)) {
        continue
      }

      const packageRecord = findPackageRecord(installedPackages, installation.id)

      nextEntries.set(
        installation.id,
        buildInstalledEntry(this.layout, installation.id, installation, packageRecord)
      )
    }

    const sortedEntries = [...nextEntries.values()].sort(compareInstalledEntries)
    this.entries = sortedEntries
    this.byId = new Map()

    for (const entry of sortedEntries) {
      if (!this.byId.has(entry.id)) {
        this.byId.set(entry.id, entry)
      }
    }

    return sortedEntries
  }

  list(): readonly ExtensionInstalledEntry[] {
    return this.entries
  }

  get(extensionId: string): ExtensionInstalledEntry | undefined {
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
          `[ExtensionInstallationView] Failed to parse manifest for package "${directoryName}":`,
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

function buildInstalledEntry(
  layout: ExtensionPackageLayout,
  extensionId: string,
  installation: ExtensionInstallationRow | null,
  pkg: ScannedExtensionPackage | null
): ExtensionInstalledEntry {
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
      updatePolicy: installation?.updatePolicy ?? null,
      pinnedVersion: installation?.pinnedVersion ?? null,
      channel: installation?.channel ?? null,
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
  const status = getInstalledPackageStatus({ builtin, hasIssues })
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
    updatePolicy: installation?.updatePolicy ?? null,
    pinnedVersion: installation?.pinnedVersion ?? null,
    channel: installation?.channel ?? null,
    installedAt: toIsoString(installation?.installedAt),
    updatedAt: toIsoString(installation?.updatedAt),
    packagePath,
    manifestPath,
    dataPath,
    tempPath
  }
}

function getInstalledPackageStatus(options: {
  builtin: boolean
  hasIssues: boolean
}): ExtensionInstalledEntry['status'] {
  if (options.builtin) {
    return options.hasIssues ? 'invalid' : 'ready'
  }

  return options.hasIssues ? 'invalid' : 'ready'
}

function compareInstalledEntries(
  left: ExtensionInstalledEntry,
  right: ExtensionInstalledEntry
): number {
  const statusWeight = getStatusWeight(left.status) - getStatusWeight(right.status)
  if (statusWeight !== 0) {
    return statusWeight
  }

  const leftName = left.manifest?.name ?? left.id
  const rightName = right.manifest?.name ?? right.id
  return leftName.localeCompare(rightName, 'en')
}

function getStatusWeight(status: ExtensionInstalledEntry['status']): number {
  switch (status) {
    case 'ready':
      return 0
    case 'invalid':
      return 1
    case 'missing-package':
      return 2
  }
}

function findPackageRecord(
  packages: readonly ScannedExtensionPackage[],
  extensionId: string
): ScannedExtensionPackage | null {
  for (const packageRecord of packages) {
    if (packageRecord.directoryName === extensionId) {
      return packageRecord
    }
  }

  return null
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
