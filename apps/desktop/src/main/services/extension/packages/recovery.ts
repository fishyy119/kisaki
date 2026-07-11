import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { movePath, pathExists } from '@main/utils/fs'
import { createLogger } from '@main/log'
import type { ExtensionInstallationRow } from '@shared/db'
import { resolveInsideRoot } from '../shared/path-confinement'
import type { ExtensionInstallationStore } from '../installations'
import type { ExtensionPackageArchiveStore } from './archive'
import type { ExtensionPackageLayout } from './layout'
import {
  createRetainedArchiveSha256Set,
  inspectPackageDirectory,
  validateInstalledPackageIntegrity
} from './integrity'

const log = createLogger('Extension')

interface PackageDirectoryInfo extends WorkspacePackageInfo {
  directoryName: string
}

interface WorkspacePackageInfo {
  path: string
  extensionId: string | null
  version: string | null
  valid: boolean
}

interface VerifiedRecoverySource extends WorkspacePackageInfo {
  actionType: 'restored-backup' | 'restored-trash'
}

export interface ExtensionPackageRecoveryResult {
  actions: readonly ExtensionPackageRecoveryAction[]
  issues: readonly string[]
}

export type ExtensionPackageRecoveryAction =
  | { type: 'pruned-download'; path: string }
  | { type: 'pruned-staging'; path: string }
  | { type: 'pruned-quarantine'; path: string }
  | { type: 'pruned-archive'; path: string }
  | { type: 'restored-backup'; extensionId: string; path: string }
  | { type: 'restored-trash'; extensionId: string; path: string }
  | { type: 'removed-backup'; path: string }
  | { type: 'removed-trash'; path: string }
  | {
      type: 'quarantined-untracked-package'
      extensionId: string | null
      path: string
      quarantinePath: string
    }

export class ExtensionPackageRecovery {
  constructor(
    private readonly layout: ExtensionPackageLayout,
    private readonly archiveStore: ExtensionPackageArchiveStore,
    private readonly installations: ExtensionInstallationStore
  ) {}

  async recover(): Promise<ExtensionPackageRecoveryResult> {
    await this.layout.ensureBaseDirectories()

    const actions: ExtensionPackageRecoveryAction[] = []
    const issues: string[] = []

    await pruneDirectoryChildren(this.layout.downloadsDir, (entryPath) => {
      actions.push({ type: 'pruned-download', path: entryPath })
    })
    await pruneDirectoryChildren(this.layout.stagingDir, (entryPath) => {
      actions.push({ type: 'pruned-staging', path: entryPath })
    })
    await pruneDirectoryChildren(this.layout.quarantineDir, (entryPath) => {
      actions.push({ type: 'pruned-quarantine', path: entryPath })
    })

    const installations = this.installations.list()
    const retainedArchiveSha256s = createRetainedArchiveSha256Set(installations)
    await this.archiveStore.pruneUnusedArchives(retainedArchiveSha256s, (entryPath) => {
      actions.push({ type: 'pruned-archive', path: entryPath })
    })

    const installationById = new Map(installations.map((row) => [row.id, row]))
    const installationIds = new Set(installations.map((row) => row.id))
    const activePackages = await scanPackageDirectories(this.layout.packagesDir)
    const backupPackages = await scanWorkspacePackages(this.layout.backupsDir)
    const trashPackages = await scanWorkspacePackages(this.layout.trashDir)

    for (const activePackage of activePackages) {
      if (installationIds.has(activePackage.directoryName)) {
        continue
      }

      const quarantinePath = resolveInsideRoot(
        this.layout.quarantineDir,
        createQuarantineDirectoryName(activePackage)
      )
      await movePath(activePackage.path, quarantinePath, { overwrite: false })
      actions.push({
        type: 'quarantined-untracked-package',
        extensionId: activePackage.extensionId,
        path: activePackage.path,
        quarantinePath
      })
    }

    for (const installation of installations) {
      const activeIssue = await validateInstalledPackageIntegrity(
        this.archiveStore,
        installation,
        this.layout.packageDir(installation.id)
      )
      if (!activeIssue) {
        for (const backup of backupPackages.filter(
          (entry) => entry.extensionId === installation.id
        )) {
          await rm(backup.path, { recursive: true, force: true })
          actions.push({ type: 'removed-backup', path: backup.path })
        }
        for (const trash of trashPackages.filter(
          (entry) => entry.extensionId === installation.id
        )) {
          await rm(trash.path, { recursive: true, force: true })
          actions.push({ type: 'removed-trash', path: trash.path })
        }
        continue
      }

      const recoverySource = await findVerifiedRecoverySource(
        this.archiveStore,
        installation,
        backupPackages,
        trashPackages
      )

      if (recoverySource) {
        await rm(this.layout.packageDir(installation.id), { recursive: true, force: true }).catch(
          () => undefined
        )
        await movePath(recoverySource.path, this.layout.packageDir(installation.id), {
          overwrite: false
        })
        actions.push({
          type: recoverySource.actionType,
          extensionId: installation.id,
          path: recoverySource.path
        })
        await removeWorkspacePackagesForExtension(
          backupPackages,
          trashPackages,
          installation.id,
          actions
        )
        continue
      }

      issues.push(
        `Extension "${installation.id}" has an installation record for ${
          installation.version
        }, but its active package is missing or invalid: ${activeIssue}`
      )
    }

    for (const backup of backupPackages) {
      if (!(await pathExists(backup.path))) {
        continue
      }

      const installation = backup.extensionId ? installationById.get(backup.extensionId) : null
      const activeIssue = installation
        ? await validateInstalledPackageIntegrity(
            this.archiveStore,
            installation,
            this.layout.packageDir(installation.id)
          )
        : 'missing installation'
      if (!backup.extensionId || !installationIds.has(backup.extensionId) || !activeIssue) {
        await rm(backup.path, { recursive: true, force: true })
        actions.push({ type: 'removed-backup', path: backup.path })
      }
    }

    for (const trash of trashPackages) {
      if (!(await pathExists(trash.path))) {
        continue
      }

      if (!trash.extensionId || !installationIds.has(trash.extensionId)) {
        await rm(trash.path, { recursive: true, force: true })
        actions.push({ type: 'removed-trash', path: trash.path })
      }
    }

    return {
      actions,
      issues
    }
  }
}

async function pruneDirectoryChildren(
  directory: string,
  onPruned: (entryPath: string) => void
): Promise<void> {
  await mkdir(directory, { recursive: true })
  const entries = await readdir(directory)
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry)
      await rm(entryPath, { recursive: true, force: true })
      onPruned(entryPath)
    })
  )
}

async function scanWorkspacePackages(directory: string): Promise<readonly WorkspacePackageInfo[]> {
  const entries = await scanPackageDirectories(directory)
  return entries.map(({ path, extensionId, version, valid }) => ({
    path,
    extensionId,
    version,
    valid
  }))
}

async function scanPackageDirectories(directory: string): Promise<readonly PackageDirectoryInfo[]> {
  await mkdir(directory, { recursive: true })
  const entries = await readdir(directory, { withFileTypes: true })
  const packages: PackageDirectoryInfo[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const entryPath = path.join(directory, entry.name)
    const inspected = await inspectPackageDirectory(entryPath)
    packages.push({
      path: entryPath,
      directoryName: entry.name,
      extensionId: inspected.extensionId,
      version: inspected.version,
      valid: inspected.valid
    })
  }

  return packages
}

async function removeWorkspacePackagesForExtension(
  backupPackages: readonly WorkspacePackageInfo[],
  trashPackages: readonly WorkspacePackageInfo[],
  extensionId: string,
  actions: ExtensionPackageRecoveryAction[]
): Promise<void> {
  for (const backup of backupPackages.filter((entry) => entry.extensionId === extensionId)) {
    if (!(await pathExists(backup.path))) {
      continue
    }

    await rm(backup.path, { recursive: true, force: true })
    actions.push({ type: 'removed-backup', path: backup.path })
  }

  for (const trash of trashPackages.filter((entry) => entry.extensionId === extensionId)) {
    if (!(await pathExists(trash.path))) {
      continue
    }

    await rm(trash.path, { recursive: true, force: true })
    actions.push({ type: 'removed-trash', path: trash.path })
  }
}

async function findVerifiedRecoverySource(
  archiveStore: ExtensionPackageArchiveStore,
  installation: ExtensionInstallationRow,
  backupPackages: readonly WorkspacePackageInfo[],
  trashPackages: readonly WorkspacePackageInfo[]
): Promise<VerifiedRecoverySource | null> {
  const candidates: VerifiedRecoverySource[] = [
    ...backupPackages
      .filter(
        (entry) => entry.extensionId === installation.id && entry.version === installation.version
      )
      .map((entry) => ({ ...entry, actionType: 'restored-backup' as const })),
    ...trashPackages
      .filter(
        (entry) => entry.extensionId === installation.id && entry.version === installation.version
      )
      .map((entry) => ({ ...entry, actionType: 'restored-trash' as const }))
  ]

  for (const candidate of candidates) {
    if (!(await pathExists(candidate.path))) {
      continue
    }

    const issue = await validateInstalledPackageIntegrity(
      archiveStore,
      installation,
      candidate.path
    )
    if (!issue) {
      return candidate
    }

    log.warn('Ignored invalid recovery package.', { candidatePath: candidate.path, issue: issue })
  }

  return null
}

function createQuarantineDirectoryName(pkg: PackageDirectoryInfo): string {
  const hint = createSafeDirectoryHint(pkg.extensionId ?? pkg.directoryName)
  return `${Date.now()}-${randomUUID()}-${hint}`
}

function createSafeDirectoryHint(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
  return (normalized || 'package').slice(0, 64)
}
