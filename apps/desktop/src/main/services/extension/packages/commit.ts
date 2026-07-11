import path from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import { movePath, pathExists } from '@main/utils/fs'
import { createLogger } from '@main/log'
import type {
  CreateOrUpdateExtensionInstallationInput,
  ExtensionInstallationStore
} from '../installations'
import { assertInsideRoot } from '../shared/path-confinement'
import { createWorkspaceCleanupPaths, removeCleanupPaths } from './cleanup'
import type { ExtensionPackageLayout } from './layout'
import { wrapExtensionPackageError } from './types'

const log = createLogger('Extension')

export type ExpectedPreviousActivePackage = 'none' | 'present' | 'any'

export interface PutActiveExtensionPackageInput {
  workspaceId: string
  extensionId: string
  stagedPackageDir: string
  installation: CreateOrUpdateExtensionInstallationInput
  expectedPrevious: ExpectedPreviousActivePackage
  cleanupPaths?: readonly string[]
}

export interface RemoveActiveExtensionPackageInput {
  workspaceId: string
  extensionId: string
  cleanupPaths?: readonly string[]
}

export class ExtensionPackageCommitter {
  constructor(
    private readonly layout: ExtensionPackageLayout,
    private readonly installations: ExtensionInstallationStore
  ) {}

  async putActivePackage(input: PutActiveExtensionPackageInput): Promise<void> {
    const workspacePaths = this.layout.workspacePaths(input.workspaceId)
    const packagePath = this.layout.packageDir(input.extensionId)
    const backupPath = workspacePaths.backupDir
    const workspaceTempCleanupPaths = createWorkspaceCleanupPaths(this.layout, [
      workspacePaths.stagingDir,
      workspacePaths.downloadPath,
      ...(input.cleanupPaths ?? [])
    ])
    const successCleanupPaths = createWorkspaceCleanupPaths(this.layout, [
      workspacePaths.backupDir,
      ...workspaceTempCleanupPaths
    ])

    let backupCreated = false
    let stagedMoved = false
    let committed = false

    try {
      if (input.extensionId !== input.installation.id) {
        throw new Error(
          `Package commit extension id "${input.extensionId}" does not match installation id "${input.installation.id}".`
        )
      }

      assertInsideRoot(input.stagedPackageDir, workspacePaths.stagingDir)
      const existingPackage = await pathExists(packagePath)
      assertExpectedPrevious(input.expectedPrevious, existingPackage, input.extensionId)

      await Promise.all([
        mkdir(this.layout.packagesDir, { recursive: true }),
        mkdir(path.dirname(backupPath), { recursive: true })
      ])
      await rm(backupPath, { recursive: true, force: true }).catch(() => undefined)

      if (existingPackage) {
        await movePath(packagePath, backupPath, { overwrite: false })
        backupCreated = true
      }

      await movePath(input.stagedPackageDir, packagePath, { overwrite: false })
      stagedMoved = true

      this.installations.createOrUpdate(input.installation)
      committed = true
    } catch (error) {
      await restorePreviousActivePackage({
        packagePath,
        backupPath,
        backupCreated,
        stagedMoved
      }).catch((restoreError) => {
        log.error('Failed to restore previous active package.', restoreError, {
          extensionId: input.extensionId
        })
      })

      throw wrapExtensionPackageError(error, {
        stage: 'commit',
        message: 'Failed to commit extension package state',
        path: packagePath
      })
    } finally {
      await removeCleanupPaths(committed ? successCleanupPaths : workspaceTempCleanupPaths)
    }
  }

  async removeActivePackage(input: RemoveActiveExtensionPackageInput): Promise<void> {
    const workspacePaths = this.layout.workspacePaths(input.workspaceId)
    const packagePath = this.layout.packageDir(input.extensionId)
    const trashPath = workspacePaths.trashDir
    const workspaceTempCleanupPaths = createWorkspaceCleanupPaths(this.layout, [
      workspacePaths.stagingDir,
      workspacePaths.downloadPath,
      ...(input.cleanupPaths ?? [])
    ])
    const successCleanupPaths = createWorkspaceCleanupPaths(this.layout, [
      workspacePaths.trashDir,
      ...workspaceTempCleanupPaths
    ])

    let trashed = false
    let committed = false

    try {
      const existingPackage = await pathExists(packagePath)

      await mkdir(path.dirname(trashPath), { recursive: true })
      await rm(trashPath, { recursive: true, force: true }).catch(() => undefined)

      if (existingPackage) {
        await movePath(packagePath, trashPath, { overwrite: false })
        trashed = true
      }

      this.installations.remove(input.extensionId)
      committed = true
    } catch (error) {
      if (trashed) {
        await movePath(trashPath, packagePath, { overwrite: false }).catch((restoreError) => {
          log.error('Failed to restore trashed extension package.', restoreError, {
            extensionId: input.extensionId
          })
        })
      }

      throw wrapExtensionPackageError(error, {
        stage: 'commit',
        message: 'Failed to remove active extension package state',
        path: packagePath
      })
    } finally {
      await removeCleanupPaths(committed ? successCleanupPaths : workspaceTempCleanupPaths)
    }
  }
}

async function restorePreviousActivePackage(options: {
  packagePath: string
  backupPath: string
  backupCreated: boolean
  stagedMoved: boolean
}): Promise<void> {
  if (options.stagedMoved) {
    await rm(options.packagePath, { recursive: true, force: true })
  }

  if (options.backupCreated) {
    await movePath(options.backupPath, options.packagePath, { overwrite: false })
  }
}

function assertExpectedPrevious(
  expectedPrevious: ExpectedPreviousActivePackage,
  activePackageExists: boolean,
  extensionId: string
): void {
  if (expectedPrevious === 'none' && activePackageExists) {
    throw new Error(`Extension "${extensionId}" already has an active package.`)
  }

  if (expectedPrevious === 'present' && !activePackageExists) {
    throw new Error(`Extension "${extensionId}" does not have an active package to replace.`)
  }
}
