/**
 * Filesystem and path helpers complementing node:fs/promises.
 */

import { access, cp, mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'

/** Returns whether a candidate path is the root itself or lives under it. */
export function isInsideOrEqualPath(rootDir: string, candidatePath: string): boolean {
  const root = path.resolve(rootDir)
  const candidate = path.resolve(candidatePath)
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

/** Returns whether a filesystem path exists. */
export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

/** Recreates a directory as empty. */
export async function emptyDir(targetDir: string): Promise<void> {
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(targetDir, { recursive: true })
}

export interface MovePathOptions {
  /** Replace an existing target. Defaults to false, which throws instead. */
  overwrite?: boolean
}

/**
 * Moves a file or directory, creating the target parent directory and falling
 * back to copy + delete when rename crosses devices.
 */
export async function movePath(
  sourcePath: string,
  targetPath: string,
  options?: MovePathOptions
): Promise<void> {
  if (await pathExists(targetPath)) {
    if (!options?.overwrite) {
      throw new Error(`Destination path already exists: ${targetPath}`)
    }
    await rm(targetPath, { recursive: true, force: true })
  }

  await mkdir(path.dirname(targetPath), { recursive: true })

  try {
    await rename(sourcePath, targetPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
      throw error
    }
    await cp(sourcePath, targetPath, { recursive: true })
    await rm(sourcePath, { recursive: true, force: true })
  }
}
