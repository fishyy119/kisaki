import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import AdmZip from 'adm-zip'
import fse from 'fs-extra'
import log from 'electron-log/main'
import { and, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import {
  extensionInstallations,
  extensionSignerTrusts,
  type ExtensionInstallationRow,
  type ExtensionInstallReason,
  type ExtensionSignerTrustRow,
  type ExtensionUpdatePolicy
} from '@shared/db'
import type * as schema from '@shared/db'
import type {
  ExtensionInstallationSource,
  ExtensionRepositoryInstallationSource
} from '@shared/extension/installation-source'
import type { ExtensionRegistryArtifact } from '@kisaki/extension-registry'
import { createExtensionRegistryReleaseDigest } from '@kisaki/extension-registry/node'
import type { TrustExtensionSignerInput } from '../signers/store'
import { ExtensionSignerTrustStore } from '../signers/store'
import { ExtensionInstallationStore } from '../installations/store'
import { INSTALLED_EXTENSION_ARCHIVE_RELATIVE_PATH, type ExtensionPackageLayout } from './layout'
import { readExtensionManifestFile, validateInstalledExtensionPackage } from './manifest'
import { assertInsideRoot, resolveInsideRoot } from '../shared/path-confinement'
import { wrapExtensionPackageError } from './types'
import { ExtensionPackageVerifier, hashFile, type ExtensionPackageArchiveEntry } from './verifier'

export interface ExtensionPackageInstallationWrite {
  id: string
  enabled?: boolean
  version: string
  source: ExtensionInstallationSource
  installReason?: ExtensionInstallReason
  updatePolicy?: ExtensionUpdatePolicy
  pinnedVersion?: string | null
  channel?: string
  installedAt?: Date
}

export interface ReplaceActiveExtensionPackageInput {
  operationId: string
  extensionId: string
  stagedPackageDir: string
  installation: ExtensionPackageInstallationWrite
  signerTrusts?: readonly TrustExtensionSignerInput[]
  cleanupPaths?: readonly string[]
}

export interface UninstallExtensionPackageInput {
  operationId: string
  extensionId: string
  cleanupPaths?: readonly string[]
}

export interface ExtensionPackageTransactionHandle {
  extensionId: string
  packagePath: string
  backupPath: string | null
  trashPath: string | null
  commit(): Promise<void>
  rollback(): Promise<void>
}

export interface ExtensionPackageRecoveryResult {
  actions: readonly ExtensionPackageRecoveryAction[]
  issues: readonly string[]
}

export type ExtensionPackageRecoveryAction =
  | { type: 'pruned-download'; path: string }
  | { type: 'pruned-staging'; path: string }
  | { type: 'pruned-quarantine'; path: string }
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

export class ExtensionPackageTransaction {
  constructor(
    private readonly layout: ExtensionPackageLayout,
    private readonly db: BetterSQLite3Database<typeof schema>
  ) {}

  async replaceActivePackage(
    input: ReplaceActiveExtensionPackageInput
  ): Promise<ExtensionPackageTransactionHandle> {
    const operationPaths = this.layout.operationPaths(input.operationId)
    const packagePath = this.layout.packageDir(input.extensionId)
    const backupPath = operationPaths.backupDir
    const previousInstallation = new ExtensionInstallationStore(this.db).get(input.extensionId)
    const previousSignerTrusts = snapshotSignerTrusts(this.db, input.signerTrusts ?? [])
    const existingPackage = await fse.pathExists(packagePath)
    assertInsideRoot(input.stagedPackageDir, operationPaths.stagingDir)

    await Promise.all([
      fse.ensureDir(this.layout.packagesDir),
      fse.ensureDir(this.layout.dataPath(input.extensionId)),
      fse.ensureDir(this.layout.runtimeTempPath(input.extensionId)),
      fse.ensureDir(path.dirname(backupPath))
    ])
    await fse.remove(backupPath).catch(() => undefined)

    let backupCreated = false
    let stagedMoved = false
    let dbCommitted = false

    try {
      if (existingPackage) {
        await fse.move(packagePath, backupPath, { overwrite: false })
        backupCreated = true
      }

      await fse.move(input.stagedPackageDir, packagePath, { overwrite: false })
      stagedMoved = true

      this.db.transaction((tx) => {
        const installationStore = new ExtensionInstallationStore(tx)
        const signerStore = new ExtensionSignerTrustStore(tx)
        const existing = installationStore.get(input.extensionId)

        if (existing) {
          installationStore.update(input.extensionId, {
            enabled: input.installation.enabled,
            version: input.installation.version,
            source: input.installation.source,
            installReason: input.installation.installReason,
            updatePolicy: input.installation.updatePolicy,
            pinnedVersion: input.installation.pinnedVersion,
            channel: input.installation.channel
          })
        } else {
          installationStore.create(input.installation)
        }

        for (const signerTrust of input.signerTrusts ?? []) {
          signerStore.trust(signerTrust)
        }
      })
      dbCommitted = true
    } catch (error) {
      await rollbackReplace({
        packagePath,
        backupPath,
        backupCreated,
        stagedPackageDir: input.stagedPackageDir,
        stagedMoved
      }).catch((rollbackError) => {
        log.error(
          '[ExtensionPackageTransaction] Failed to roll back package replace:',
          rollbackError
        )
      })
      throw wrapExtensionPackageError(error, {
        stage: 'commit',
        message: 'Failed to commit extension package replacement',
        path: packagePath
      })
    }

    let finalized = false
    const restoreDb = (): void =>
      restoreInstallationSnapshot(this.db, input.extensionId, previousInstallation)
    const cleanupPaths = createCleanupPaths(this.layout, [
      operationPaths.stagingDir,
      operationPaths.downloadPath,
      ...(input.cleanupPaths ?? [])
    ])

    return {
      extensionId: input.extensionId,
      packagePath,
      backupPath: backupCreated ? backupPath : null,
      trashPath: null,
      commit: async () => {
        finalized = true
        if (backupCreated) {
          await fse.remove(backupPath).catch((error) => {
            log.warn(
              `[ExtensionPackageTransaction] Failed to remove backup "${backupPath}":`,
              error
            )
          })
        }
        await removeCleanupPaths(cleanupPaths)
      },
      rollback: async () => {
        if (finalized) {
          return
        }

        await rollbackReplace({
          packagePath,
          backupPath,
          backupCreated,
          stagedPackageDir: input.stagedPackageDir,
          stagedMoved
        })

        if (dbCommitted) {
          restoreDb()
          restoreSignerTrustSnapshots(this.db, previousSignerTrusts)
        }

        await removeCleanupPaths(cleanupPaths)
      }
    }
  }

  async uninstallPackage(
    input: UninstallExtensionPackageInput
  ): Promise<ExtensionPackageTransactionHandle> {
    const operationPaths = this.layout.operationPaths(input.operationId)
    const packagePath = this.layout.packageDir(input.extensionId)
    const trashPath = operationPaths.trashDir
    const previousInstallation = new ExtensionInstallationStore(this.db).get(input.extensionId)
    const existingPackage = await fse.pathExists(packagePath)

    await fse.ensureDir(path.dirname(trashPath))
    await fse.remove(trashPath).catch(() => undefined)

    let trashed = false
    let dbCommitted = false

    try {
      if (existingPackage) {
        await fse.move(packagePath, trashPath, { overwrite: false })
        trashed = true
      }

      this.db.transaction((tx) => {
        new ExtensionInstallationStore(tx).remove(input.extensionId)
      })
      dbCommitted = true
    } catch (error) {
      if (trashed) {
        await fse.move(trashPath, packagePath, { overwrite: false }).catch((rollbackError) => {
          log.error(
            '[ExtensionPackageTransaction] Failed to restore trashed extension package:',
            rollbackError
          )
        })
      }
      throw wrapExtensionPackageError(error, {
        stage: 'commit',
        message: 'Failed to commit extension package uninstall',
        path: packagePath
      })
    }

    let finalized = false
    const cleanupPaths = createCleanupPaths(this.layout, [
      operationPaths.downloadPath,
      operationPaths.stagingDir,
      ...(input.cleanupPaths ?? [])
    ])

    return {
      extensionId: input.extensionId,
      packagePath,
      backupPath: null,
      trashPath: trashed ? trashPath : null,
      commit: async () => {
        finalized = true
        if (trashed) {
          await fse.remove(trashPath).catch((error) => {
            log.warn(`[ExtensionPackageTransaction] Failed to remove trash "${trashPath}":`, error)
          })
        }
        await removeCleanupPaths(cleanupPaths)
      },
      rollback: async () => {
        if (finalized) {
          return
        }

        if (trashed) {
          await fse.remove(packagePath).catch(() => undefined)
          await fse.move(trashPath, packagePath, { overwrite: false })
        }

        if (dbCommitted) {
          restoreInstallationSnapshot(this.db, input.extensionId, previousInstallation)
        }

        await removeCleanupPaths(cleanupPaths)
      }
    }
  }

  async recover(): Promise<ExtensionPackageRecoveryResult> {
    await this.layout.ensureBaseDirectories()

    const actions: ExtensionPackageRecoveryAction[] = []
    const issues: string[] = []

    await this.pruneDirectoryChildren(this.layout.downloadsDir, (entryPath) => {
      actions.push({ type: 'pruned-download', path: entryPath })
    })
    await this.pruneDirectoryChildren(this.layout.stagingDir, (entryPath) => {
      actions.push({ type: 'pruned-staging', path: entryPath })
    })
    await this.pruneDirectoryChildren(this.layout.quarantineDir, (entryPath) => {
      actions.push({ type: 'pruned-quarantine', path: entryPath })
    })

    const installations = new ExtensionInstallationStore(this.db).list()
    const installationById = new Map(installations.map((row) => [row.id, row]))
    const installationIds = new Set(installations.map((row) => row.id))
    const activePackages = await this.scanPackageDirectories(this.layout.packagesDir)
    const backupPackages = await this.scanOperationPackages(this.layout.backupsDir)
    const trashPackages = await this.scanOperationPackages(this.layout.trashDir)

    for (const activePackage of activePackages) {
      if (installationIds.has(activePackage.directoryName)) {
        continue
      }

      const quarantinePath = resolveInsideRoot(
        this.layout.quarantineDir,
        createQuarantineDirectoryName(activePackage)
      )
      await fse.move(activePackage.path, quarantinePath, { overwrite: false })
      actions.push({
        type: 'quarantined-untracked-package',
        extensionId: activePackage.extensionId,
        path: activePackage.path,
        quarantinePath
      })
    }

    for (const installation of installations) {
      const activeIssue = await validatePackageForInstallation(
        this.layout,
        installation,
        this.layout.packageDir(installation.id)
      )
      if (!activeIssue) {
        for (const backup of backupPackages.filter(
          (entry) => entry.extensionId === installation.id
        )) {
          await fse.remove(backup.path)
          actions.push({ type: 'removed-backup', path: backup.path })
        }
        for (const trash of trashPackages.filter(
          (entry) => entry.extensionId === installation.id
        )) {
          await fse.remove(trash.path)
          actions.push({ type: 'removed-trash', path: trash.path })
        }
        continue
      }

      const recoverySource = await findVerifiedRecoverySource(
        this.layout,
        installation,
        backupPackages,
        trashPackages
      )

      if (recoverySource) {
        await fse.remove(this.layout.packageDir(installation.id)).catch(() => undefined)
        await fse.move(recoverySource.path, this.layout.packageDir(installation.id), {
          overwrite: false
        })
        actions.push({
          type: recoverySource.actionType,
          extensionId: installation.id,
          path: recoverySource.path
        })
        await this.removeOperationPackagesForExtension(
          backupPackages,
          trashPackages,
          installation.id,
          actions
        )
        continue
      }

      issues.push(
        `Extension "${installation.id}" has an installation record for ${installation.version}, but its active package is missing or invalid: ${activeIssue}`
      )
    }

    for (const backup of backupPackages) {
      if (!(await fse.pathExists(backup.path))) {
        continue
      }

      const installation = backup.extensionId ? installationById.get(backup.extensionId) : null
      const activeIssue = installation
        ? await validatePackageForInstallation(
            this.layout,
            installation,
            this.layout.packageDir(installation.id)
          )
        : 'missing installation'
      if (!backup.extensionId || !installationIds.has(backup.extensionId) || !activeIssue) {
        await fse.remove(backup.path)
        actions.push({ type: 'removed-backup', path: backup.path })
      }
    }

    for (const trash of trashPackages) {
      if (!(await fse.pathExists(trash.path))) {
        continue
      }

      if (!trash.extensionId || !installationIds.has(trash.extensionId)) {
        await fse.remove(trash.path)
        actions.push({ type: 'removed-trash', path: trash.path })
      }
    }

    return {
      actions,
      issues
    }
  }

  private async pruneDirectoryChildren(
    directory: string,
    onPruned: (entryPath: string) => void
  ): Promise<void> {
    await fse.ensureDir(directory)
    const entries = await fse.readdir(directory)
    await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(directory, entry)
        await fse.remove(entryPath)
        onPruned(entryPath)
      })
    )
  }

  private async scanOperationPackages(directory: string): Promise<readonly OperationPackageInfo[]> {
    const entries = await this.scanPackageDirectories(directory)
    return entries.map(({ path, extensionId, version, valid }) => ({
      path,
      extensionId,
      version,
      valid
    }))
  }

  private async scanPackageDirectories(
    directory: string
  ): Promise<readonly PackageDirectoryInfo[]> {
    await fse.ensureDir(directory)
    const entries = await fse.readdir(directory, { withFileTypes: true })
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

  private async removeOperationPackagesForExtension(
    backupPackages: readonly OperationPackageInfo[],
    trashPackages: readonly OperationPackageInfo[],
    extensionId: string,
    actions: ExtensionPackageRecoveryAction[]
  ): Promise<void> {
    for (const backup of backupPackages.filter((entry) => entry.extensionId === extensionId)) {
      if (!(await fse.pathExists(backup.path))) {
        continue
      }

      await fse.remove(backup.path)
      actions.push({ type: 'removed-backup', path: backup.path })
    }

    for (const trash of trashPackages.filter((entry) => entry.extensionId === extensionId)) {
      if (!(await fse.pathExists(trash.path))) {
        continue
      }

      await fse.remove(trash.path)
      actions.push({ type: 'removed-trash', path: trash.path })
    }
  }
}

interface PackageDirectoryInfo extends OperationPackageInfo {
  directoryName: string
}

interface OperationPackageInfo {
  path: string
  extensionId: string | null
  version: string | null
  valid: boolean
}

interface VerifiedRecoverySource extends OperationPackageInfo {
  actionType: 'restored-backup' | 'restored-trash'
}

async function rollbackReplace(options: {
  packagePath: string
  backupPath: string
  backupCreated: boolean
  stagedPackageDir: string
  stagedMoved: boolean
}): Promise<void> {
  if (options.stagedMoved) {
    await fse.remove(options.packagePath)
  } else {
    await fse.remove(options.stagedPackageDir)
  }

  if (options.backupCreated) {
    await fse.move(options.backupPath, options.packagePath, { overwrite: false })
  }
}

function restoreInstallationSnapshot(
  db: BetterSQLite3Database<typeof schema>,
  extensionId: string,
  snapshot: ExtensionInstallationRow | null
): void {
  db.transaction((tx) => {
    if (!snapshot) {
      new ExtensionInstallationStore(tx).remove(extensionId)
      return
    }

    tx.insert(extensionInstallations)
      .values(snapshot)
      .onConflictDoUpdate({
        target: extensionInstallations.id,
        set: {
          enabled: snapshot.enabled,
          version: snapshot.version,
          source: snapshot.source,
          installReason: snapshot.installReason,
          updatePolicy: snapshot.updatePolicy,
          pinnedVersion: snapshot.pinnedVersion,
          channel: snapshot.channel,
          installedAt: snapshot.installedAt,
          updatedAt: snapshot.updatedAt
        }
      })
      .run()
  })
}

interface ExtensionSignerTrustSnapshot {
  extensionId: string
  fingerprint: string
  row: ExtensionSignerTrustRow | null
}

function snapshotSignerTrusts(
  db: BetterSQLite3Database<typeof schema>,
  signerTrusts: readonly TrustExtensionSignerInput[]
): readonly ExtensionSignerTrustSnapshot[] {
  const store = new ExtensionSignerTrustStore(db)
  const seen = new Set<string>()
  const snapshots: ExtensionSignerTrustSnapshot[] = []

  for (const signerTrust of signerTrusts) {
    const key = `${signerTrust.extensionId}\0${signerTrust.fingerprint}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    snapshots.push({
      extensionId: signerTrust.extensionId,
      fingerprint: signerTrust.fingerprint,
      row: store.getByScope(signerTrust.extensionId, signerTrust.fingerprint)
    })
  }

  return snapshots
}

function restoreSignerTrustSnapshots(
  db: BetterSQLite3Database<typeof schema>,
  snapshots: readonly ExtensionSignerTrustSnapshot[]
): void {
  if (snapshots.length === 0) {
    return
  }

  db.transaction((tx) => {
    for (const snapshot of snapshots) {
      if (!snapshot.row) {
        tx.delete(extensionSignerTrusts)
          .where(
            and(
              eq(extensionSignerTrusts.extensionId, snapshot.extensionId),
              eq(extensionSignerTrusts.fingerprint, snapshot.fingerprint)
            )
          )
          .run()
        continue
      }

      tx.insert(extensionSignerTrusts)
        .values(snapshot.row)
        .onConflictDoUpdate({
          target: [extensionSignerTrusts.extensionId, extensionSignerTrusts.fingerprint],
          set: {
            id: snapshot.row.id,
            algorithm: snapshot.row.algorithm,
            publicKey: snapshot.row.publicKey,
            label: snapshot.row.label,
            trustedFromRepositoryId: snapshot.row.trustedFromRepositoryId,
            trustedFromRepositoryUrl: snapshot.row.trustedFromRepositoryUrl,
            trustedAt: snapshot.row.trustedAt,
            createdAt: snapshot.row.createdAt,
            updatedAt: snapshot.row.updatedAt
          }
        })
        .run()
    }
  })
}

async function inspectPackageDirectory(packageDir: string): Promise<{
  valid: boolean
  extensionId: string | null
  version: string | null
}> {
  try {
    const parsed = await readExtensionManifestFile(path.join(packageDir, 'manifest.json'))
    if (!parsed.manifest) {
      return { valid: false, extensionId: null, version: null }
    }

    const issues = await validateInstalledExtensionPackage(packageDir, parsed.manifest)
    return {
      valid: issues.length === 0,
      extensionId: parsed.manifest.id,
      version: parsed.manifest.version
    }
  } catch {
    return { valid: false, extensionId: null, version: null }
  }
}

async function findVerifiedRecoverySource(
  layout: ExtensionPackageLayout,
  installation: ExtensionInstallationRow,
  backupPackages: readonly OperationPackageInfo[],
  trashPackages: readonly OperationPackageInfo[]
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
    if (!(await fse.pathExists(candidate.path))) {
      continue
    }

    const issue = await validatePackageForInstallation(layout, installation, candidate.path)
    if (!issue) {
      return candidate
    }

    log.warn(
      `[ExtensionPackageTransaction] Ignored invalid recovery package "${candidate.path}": ${issue}`
    )
  }

  return null
}

async function validatePackageForInstallation(
  layout: ExtensionPackageLayout,
  installation: ExtensionInstallationRow,
  packageDir: string
): Promise<string | null> {
  const inspected = await inspectPackageDirectory(packageDir)
  if (!inspected.valid) {
    return 'the package manifest or declared files are invalid'
  }

  if (inspected.extensionId !== installation.id) {
    return `package id mismatch: expected "${installation.id}", received "${inspected.extensionId ?? 'unknown'}"`
  }

  if (inspected.version !== installation.version) {
    return `package version mismatch: expected "${installation.version}", received "${inspected.version ?? 'unknown'}"`
  }

  try {
    await verifyInstalledPackageArchive(layout, installation, packageDir)
    return null
  } catch (error) {
    return getErrorMessage(error)
  }
}

async function verifyInstalledPackageArchive(
  layout: ExtensionPackageLayout,
  installation: ExtensionInstallationRow,
  packageDir: string
): Promise<void> {
  const archivePath = layout.packageArchivePath(packageDir)
  if (!(await fse.pathExists(archivePath))) {
    throw new Error('installed package archive is missing')
  }

  const source = installation.source
  if (!source) {
    throw new Error('installation source is missing or invalid')
  }

  const verifier = new ExtensionPackageVerifier()
  if (source.kind === 'repository') {
    await verifyRepositoryInstalledArchive(verifier, source, archivePath, packageDir)
    return
  }

  const verified = await verifier.verifyArchive({
    archivePath,
    expectedIdentity: {
      extensionId: installation.id,
      version: installation.version
    }
  })
  if (verified.sha256 !== source.artifactSha256) {
    throw new Error('local package archive sha256 checksum mismatch')
  }

  await assertPackageDirectoryMatchesArchive(packageDir, archivePath, verified.entries)
}

async function verifyRepositoryInstalledArchive(
  verifier: ExtensionPackageVerifier,
  source: ExtensionRepositoryInstallationSource,
  archivePath: string,
  packageDir: string
): Promise<void> {
  const snapshot = source.snapshot
  const releaseDigest = createExtensionRegistryReleaseDigest(
    {
      schemaVersion: snapshot.schemaVersion,
      signingKeys: snapshot.signingKeys
    },
    snapshot.package,
    snapshot.release
  )
  if (releaseDigest !== source.releaseId) {
    throw new Error('repository release digest no longer matches the installed source snapshot')
  }

  const artifact = snapshot.release.artifacts.find(
    (item) => item.url === source.artifact.url && item.sha256 === source.artifact.sha256
  )
  if (!artifact) {
    throw new Error('installed repository artifact is missing from the source snapshot')
  }

  const verified = await verifier.verifyArchive({
    archivePath,
    expectedArtifact: artifact,
    registryPackage: snapshot.package,
    registryRelease: snapshot.release,
    signingKeys: snapshot.signingKeys
  })

  assertRepositorySignatureMatchesSource(artifact, source, verified.signature)
  await assertPackageDirectoryMatchesArchive(packageDir, archivePath, verified.entries)
}

function assertRepositorySignatureMatchesSource(
  artifact: ExtensionRegistryArtifact,
  source: ExtensionRepositoryInstallationSource,
  signature: { keyId: string; fingerprint: string } | null
): void {
  if (!artifact.signature) {
    if (source.signature) {
      throw new Error('unsigned repository artifact has a recorded signer fingerprint')
    }
    return
  }

  if (!signature) {
    throw new Error('signed repository artifact did not produce a verified signer fingerprint')
  }

  if (!source.signature) {
    throw new Error('signed repository artifact is missing its recorded signer fingerprint')
  }

  if (source.signature.keyId && source.signature.keyId !== signature.keyId) {
    throw new Error('repository artifact signer key id mismatch')
  }

  if (source.signature.fingerprint !== signature.fingerprint) {
    throw new Error('repository artifact signer fingerprint mismatch')
  }
}

async function assertPackageDirectoryMatchesArchive(
  packageDir: string,
  archivePath: string,
  entries: readonly ExtensionPackageArchiveEntry[]
): Promise<void> {
  const expectedNames = new Set(entries.map((entry) => entry.normalizedName))
  const actualNames = await collectPackageFileNames(packageDir)
  const extraName = actualNames.find((name) => !expectedNames.has(name))
  if (extraName) {
    throw new Error(`installed package contains an unexpected file "${extraName}"`)
  }

  const zip = new AdmZip(archivePath)
  for (const entry of entries) {
    const archiveEntry = zip.getEntry(entry.archiveName)
    if (!archiveEntry || archiveEntry.isDirectory) {
      throw new Error(`verified archive entry "${entry.archiveName}" is missing`)
    }

    const filePath = resolveInsideRoot(packageDir, entry.normalizedName)
    const stat = await fse.lstat(filePath).catch(() => null)
    if (!stat?.isFile()) {
      throw new Error(`installed package file "${entry.normalizedName}" is missing`)
    }

    const fileInfo = await hashFile(filePath)
    const archiveBytes = archiveEntry.getData()
    if (
      fileInfo.size !== archiveBytes.byteLength ||
      fileInfo.sha256 !== createSha256(archiveBytes)
    ) {
      throw new Error(`installed package file "${entry.normalizedName}" does not match archive`)
    }
  }
}

async function collectPackageFileNames(packageDir: string): Promise<string[]> {
  const names: string[] = []
  await collectPackageFileNamesInto(packageDir, packageDir, names)
  return names
}

async function collectPackageFileNamesInto(
  rootDir: string,
  directory: string,
  names: string[]
): Promise<void> {
  const entries = await fse.readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectPackageFileNamesInto(rootDir, entryPath, names)
      continue
    }

    const relativePath = path.relative(rootDir, entryPath).split(path.sep).join('/')
    if (relativePath === INSTALLED_EXTENSION_ARCHIVE_RELATIVE_PATH) {
      continue
    }
    names.push(relativePath)
  }
}

function createSha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

async function removeCleanupPaths(paths: readonly string[]): Promise<void> {
  await Promise.all(paths.map((entryPath) => fse.remove(entryPath).catch(() => undefined)))
}

function createCleanupPaths(
  layout: ExtensionPackageLayout,
  paths: readonly string[]
): readonly string[] {
  const uniquePaths = [...new Set(paths)]
  for (const entryPath of uniquePaths) {
    assertInsideRoot(entryPath, layout.operationsDir)
  }
  return uniquePaths
}

function createQuarantineDirectoryName(pkg: PackageDirectoryInfo): string {
  const hint = createSafeDirectoryHint(pkg.extensionId ?? pkg.directoryName)
  return `${Date.now()}-${randomUUID()}-${hint}`
}

function createSafeDirectoryHint(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
  return (normalized || 'package').slice(0, 64)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
