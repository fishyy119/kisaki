import path from 'node:path'
import fse from 'fs-extra'
import { createLogger } from '@main/log'
import type { ExtensionPackageLayout } from './layout'
import { assertInsideRoot } from '../shared/path-confinement'

const log = createLogger('Extension')

export function createWorkspaceCleanupPaths(
  layout: ExtensionPackageLayout,
  paths: readonly string[]
): readonly string[] {
  const uniquePaths = [...new Set(paths)]
  for (const entryPath of uniquePaths) {
    assertInsideRoot(entryPath, layout.workspacesDir)
  }
  return uniquePaths
}

export async function removeCleanupPaths(paths: readonly string[]): Promise<void> {
  await Promise.all(
    paths.map(async (entryPath) => {
      await fse.remove(entryPath).catch((error) => {
        log.warn('Failed to remove package workspace path.', error, {
          entryName: path.basename(entryPath)
        })
      })
    })
  )
}
