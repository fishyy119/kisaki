import path from 'node:path'
import fse from 'fs-extra'
import log from 'electron-log/main'
import { ExtensionInstallationStore } from '../../installations'
import { wrapExtensionPackageError } from '../types'
import type { PackageTransactionContext } from './context'
import { createCleanupPaths, removeCleanupPaths } from './filesystem'
import type { ExtensionPackageTransactionHandle, UninstallExtensionPackageInput } from './types'

export async function uninstallPackage(
  context: PackageTransactionContext,
  input: UninstallExtensionPackageInput
): Promise<ExtensionPackageTransactionHandle> {
  const { layout, db } = context
  const operationPaths = layout.operationPaths(input.operationId)
  const packagePath = layout.packageDir(input.extensionId)
  const trashPath = operationPaths.trashDir
  const previousInstallation = new ExtensionInstallationStore(db).get(input.extensionId)
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

    db.transaction((tx) => {
      new ExtensionInstallationStore(tx).remove(input.extensionId)
    })
    dbCommitted = true
  } catch (error) {
    if (trashed) {
      await fse.move(trashPath, packagePath, { overwrite: false }).catch((rollbackError) => {
        log.error(
          '[ExtensionPackageTransactionCoordinator] Failed to restore trashed extension package:',
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
  const cleanupPaths = createCleanupPaths(layout, [
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
          log.warn(
            `[ExtensionPackageTransactionCoordinator] Failed to remove trash "${trashPath}":`,
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

      if (trashed) {
        await fse.remove(packagePath).catch(() => undefined)
        await fse.move(trashPath, packagePath, { overwrite: false })
      }

      if (dbCommitted) {
        db.transaction((tx) =>
          new ExtensionInstallationStore(tx).restoreSnapshot(
            input.extensionId,
            previousInstallation
          )
        )
      }

      await removeCleanupPaths(cleanupPaths)
    }
  }
}
