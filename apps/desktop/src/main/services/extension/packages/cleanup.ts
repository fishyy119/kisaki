import fse from 'fs-extra'
import log from 'electron-log/main'
import type { ExtensionPackageLayout } from './layout'
import { assertInsideRoot } from '../shared/path-confinement'

export function createOperationCleanupPaths(
  layout: ExtensionPackageLayout,
  paths: readonly string[]
): readonly string[] {
  const uniquePaths = [...new Set(paths)]
  for (const entryPath of uniquePaths) {
    assertInsideRoot(entryPath, layout.operationsDir)
  }
  return uniquePaths
}

export async function removeCleanupPaths(
  paths: readonly string[],
  logPrefix: string
): Promise<void> {
  await Promise.all(
    paths.map(async (entryPath) => {
      await fse.remove(entryPath).catch((error) => {
        log.warn(`${logPrefix} Failed to remove operation path "${entryPath}":`, error)
      })
    })
  )
}
