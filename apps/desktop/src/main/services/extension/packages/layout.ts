import path from 'node:path'
import fse from 'fs-extra'
import { createValidationError } from '@kisaki/extension-api'
import type { ExtensionServicePaths } from '../types'
import { requireSafeExtensionId, resolveInsideRoot } from '../shared/path-confinement'

const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
export const INSTALLED_EXTENSION_METADATA_DIRECTORY = '.kisaki'
export const INSTALLED_EXTENSION_ARCHIVE_RELATIVE_PATH = `${INSTALLED_EXTENSION_METADATA_DIRECTORY}/source.kisx`

export interface ExtensionPackageOperationPaths {
  operationId: string
  downloadPath: string
  stagingDir: string
  stagingPackageDir: string
  backupDir: string
  trashDir: string
}

/**
 * Derives every extension package/data/temp path from an extension id or
 * operation id, and confines all results to the extension storage root.
 */
export class ExtensionPackageLayout {
  readonly rootDir: string
  readonly packagesDir: string
  readonly builtinPackagesDir: string
  readonly dataDir: string
  readonly tempDir: string
  readonly runtimeTempDir: string
  readonly operationsDir: string
  readonly downloadsDir: string
  readonly stagingDir: string
  readonly backupsDir: string
  readonly trashDir: string
  readonly quarantineDir: string

  constructor(
    paths: Pick<
      ExtensionServicePaths,
      'rootDir' | 'packagesDir' | 'builtinPackagesDir' | 'dataDir' | 'tempDir'
    >
  ) {
    this.rootDir = path.resolve(paths.rootDir)
    this.packagesDir = resolveInsideRoot(
      this.rootDir,
      path.relative(this.rootDir, paths.packagesDir)
    )
    this.builtinPackagesDir = path.resolve(paths.builtinPackagesDir)
    this.dataDir = resolveInsideRoot(this.rootDir, path.relative(this.rootDir, paths.dataDir))
    this.tempDir = resolveInsideRoot(this.rootDir, path.relative(this.rootDir, paths.tempDir))
    this.runtimeTempDir = resolveInsideRoot(this.tempDir, 'runtime')
    this.operationsDir = resolveInsideRoot(this.tempDir, 'operations')
    this.downloadsDir = resolveInsideRoot(this.operationsDir, 'downloads')
    this.stagingDir = resolveInsideRoot(this.operationsDir, 'staging')
    this.backupsDir = resolveInsideRoot(this.operationsDir, 'backups')
    this.trashDir = resolveInsideRoot(this.operationsDir, 'trash')
    this.quarantineDir = resolveInsideRoot(this.operationsDir, 'quarantine')
  }

  async ensureBaseDirectories(): Promise<void> {
    await Promise.all([
      fse.ensureDir(this.packagesDir),
      fse.ensureDir(this.dataDir),
      fse.ensureDir(this.runtimeTempDir),
      fse.ensureDir(this.downloadsDir),
      fse.ensureDir(this.stagingDir),
      fse.ensureDir(this.backupsDir),
      fse.ensureDir(this.trashDir),
      fse.ensureDir(this.quarantineDir)
    ])
  }

  packageDir(extensionId: string): string {
    return resolveInsideRoot(this.packagesDir, requireSafeExtensionId(extensionId))
  }

  packageManifestPath(extensionId: string): string {
    return resolveInsideRoot(this.packageDir(extensionId), 'manifest.json')
  }

  packageArchivePath(packageDir: string): string {
    return resolveInsideRoot(packageDir, INSTALLED_EXTENSION_ARCHIVE_RELATIVE_PATH)
  }

  dataPath(extensionId: string): string {
    return resolveInsideRoot(this.dataDir, requireSafeExtensionId(extensionId))
  }

  runtimeTempPath(extensionId: string): string {
    return resolveInsideRoot(this.runtimeTempDir, requireSafeExtensionId(extensionId))
  }

  operationPaths(operationId: string): ExtensionPackageOperationPaths {
    const safeOperationId = requireSafeOperationId(operationId)
    const stagingDir = resolveInsideRoot(this.stagingDir, safeOperationId)

    return {
      operationId: safeOperationId,
      downloadPath: resolveInsideRoot(this.downloadsDir, `${safeOperationId}.kisx`),
      stagingDir,
      stagingPackageDir: resolveInsideRoot(stagingDir, 'package'),
      backupDir: resolveInsideRoot(this.backupsDir, safeOperationId),
      trashDir: resolveInsideRoot(this.trashDir, safeOperationId)
    }
  }
}

export function requireSafeOperationId(value: unknown): string {
  if (typeof value === 'string' && OPERATION_ID_PATTERN.test(value)) {
    return value
  }

  throw createValidationError('operationId must be a safe non-empty identifier.')
}
