import path from 'node:path'
import fse from 'fs-extra'
import log from 'electron-log/main'
import { ExtensionInstallationStore } from '../../installations'
import { ExtensionSignerTrustStore } from '../../signers'
import { assertInsideRoot } from '../../shared/path-confinement'
import { wrapExtensionPackageError } from '../types'
import type { PackageTransactionContext } from './context'
import { createCleanupPaths, removeCleanupPaths, rollbackPackageReplace } from './filesystem'
import { snapshotSignerTrusts } from './signer-snapshots'
import type { ExtensionPackageTransactionHandle, ReplaceActiveExtensionPackageInput } from './types'

export async function replaceActivePackage(
  context: PackageTransactionContext,
  input: ReplaceActiveExtensionPackageInput
): Promise<ExtensionPackageTransactionHandle> {
  const { layout, db } = context
  const operationPaths = layout.operationPaths(input.operationId)
  const packagePath = layout.packageDir(input.extensionId)
  const backupPath = operationPaths.backupDir
  const previousInstallation = new ExtensionInstallationStore(db).get(input.extensionId)
  const previousSignerTrusts = snapshotSignerTrusts(db, input.signerTrusts ?? [])
  const existingPackage = await fse.pathExists(packagePath)
  assertInsideRoot(input.stagedPackageDir, operationPaths.stagingDir)

  await Promise.all([
    fse.ensureDir(layout.packagesDir),
    fse.ensureDir(layout.dataPath(input.extensionId)),
    fse.ensureDir(layout.runtimeTempPath(input.extensionId)),
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

    db.transaction((tx) => {
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
    await rollbackPackageReplace({
      packagePath,
      backupPath,
      backupCreated,
      stagedPackageDir: input.stagedPackageDir,
      stagedMoved
    }).catch((rollbackError) => {
      log.error(
        '[ExtensionPackageTransactionCoordinator] Failed to roll back package replace:',
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
  const cleanupPaths = createCleanupPaths(layout, [
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
            `[ExtensionPackageTransactionCoordinator] Failed to remove backup "${backupPath}":`,
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

      await rollbackPackageReplace({
        packagePath,
        backupPath,
        backupCreated,
        stagedPackageDir: input.stagedPackageDir,
        stagedMoved
      })

      if (dbCommitted) {
        db.transaction((tx) =>
          new ExtensionInstallationStore(tx).restoreSnapshot(
            input.extensionId,
            previousInstallation
          )
        )
        db.transaction((tx) =>
          new ExtensionSignerTrustStore(tx).restoreSnapshots(previousSignerTrusts)
        )
      }

      await removeCleanupPaths(cleanupPaths)
    }
  }
}
