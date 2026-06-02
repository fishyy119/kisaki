import path from 'node:path'
import fse from 'fs-extra'
import { createValidationError } from '@kisaki3/extension-api'
import type { ExtensionServicePaths } from '../types'
import { requireSafeExtensionId, resolveInsideRoot } from '../shared/path-confinement'

const WORKSPACE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/

export interface ExtensionPackageWorkspacePaths {
  downloadPath: string
  stagingDir: string
  stagingPackageDir: string
  backupDir: string
  trashDir: string
}

/**
 * Derives every extension package/data/temp path from an extension id or
 * package workspace id, and confines all results to the extension storage root.
 */
export class ExtensionPackageLayout {
  readonly rootDir: string
  readonly packagesDir: string
  readonly builtinPackagesDir: string
  readonly archivesDir: string
  readonly dataDir: string
  readonly tempDir: string
  readonly runtimeTempDir: string
  readonly workspacesDir: string
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
    this.archivesDir = resolveInsideRoot(this.rootDir, 'archives')
    this.dataDir = resolveInsideRoot(this.rootDir, path.relative(this.rootDir, paths.dataDir))
    this.tempDir = resolveInsideRoot(this.rootDir, path.relative(this.rootDir, paths.tempDir))
    this.runtimeTempDir = resolveInsideRoot(this.tempDir, 'runtime')
    this.workspacesDir = resolveInsideRoot(this.tempDir, 'workspaces')
    this.downloadsDir = resolveInsideRoot(this.workspacesDir, 'downloads')
    this.stagingDir = resolveInsideRoot(this.workspacesDir, 'staging')
    this.backupsDir = resolveInsideRoot(this.workspacesDir, 'backups')
    this.trashDir = resolveInsideRoot(this.workspacesDir, 'trash')
    this.quarantineDir = resolveInsideRoot(this.workspacesDir, 'quarantine')
  }

  async ensureBaseDirectories(): Promise<void> {
    await Promise.all([
      fse.ensureDir(this.packagesDir),
      fse.ensureDir(this.archivesDir),
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

  archivePath(sha256: string): string {
    return resolveInsideRoot(this.archivesDir, `${requireSafeArchiveSha256(sha256)}.kisx`)
  }

  dataPath(extensionId: string): string {
    return resolveInsideRoot(this.dataDir, requireSafeExtensionId(extensionId))
  }

  runtimeTempPath(extensionId: string): string {
    return resolveInsideRoot(this.runtimeTempDir, requireSafeExtensionId(extensionId))
  }

  workspacePaths(workspaceId: string): ExtensionPackageWorkspacePaths {
    const safeWorkspaceId = requireSafePackageWorkspaceId(workspaceId)
    const stagingDir = resolveInsideRoot(this.stagingDir, safeWorkspaceId)

    return {
      downloadPath: resolveInsideRoot(this.downloadsDir, `${safeWorkspaceId}.kisx`),
      stagingDir,
      stagingPackageDir: resolveInsideRoot(stagingDir, 'package'),
      backupDir: resolveInsideRoot(this.backupsDir, safeWorkspaceId),
      trashDir: resolveInsideRoot(this.trashDir, safeWorkspaceId)
    }
  }
}

export function requireSafeArchiveSha256(value: unknown): string {
  if (typeof value === 'string' && SHA256_HEX_PATTERN.test(value)) {
    return value
  }

  throw createValidationError('archive sha256 must be a lowercase SHA256 hex digest.')
}

export function requireSafePackageWorkspaceId(value: unknown): string {
  if (typeof value === 'string' && WORKSPACE_ID_PATTERN.test(value)) {
    return value
  }

  throw createValidationError('package workspace id must be a safe non-empty identifier.')
}
