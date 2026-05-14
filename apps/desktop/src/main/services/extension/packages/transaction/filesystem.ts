import fse from 'fs-extra'
import type { ExtensionPackageLayout } from '../layout'
import { assertInsideRoot } from '../../shared/path-confinement'

export async function rollbackPackageReplace(options: {
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

export async function removeCleanupPaths(paths: readonly string[]): Promise<void> {
  await Promise.all(paths.map((entryPath) => fse.remove(entryPath).catch(() => undefined)))
}

export function createCleanupPaths(
  layout: ExtensionPackageLayout,
  paths: readonly string[]
): readonly string[] {
  const uniquePaths = [...new Set(paths)]
  for (const entryPath of uniquePaths) {
    assertInsideRoot(entryPath, layout.operationsDir)
  }
  return uniquePaths
}
