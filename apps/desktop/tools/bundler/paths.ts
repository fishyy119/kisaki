import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Repository path context shared by bundler workflows. */
export interface BundlerPaths {
  desktopRoot: string
  outDir: string
}

/** Creates the desktop path context used by bundler workflows. */
export function createBundlerPaths(metaUrl = import.meta.url): BundlerPaths {
  const toolDir = path.dirname(fileURLToPath(metaUrl))
  const desktopRoot = path.resolve(toolDir, '..', '..')

  return {
    desktopRoot,
    outDir: path.join(desktopRoot, 'out')
  }
}
