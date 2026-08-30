/**
 * Filesystem and path helpers complementing node:fs/promises.
 */

import { access, cp, mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'

/**
 * Canonical form for library directory paths.
 *
 * Path identity (scanner discovery, `findExisting*` by path, persisted
 * `*DirPath` columns) compares by exact string, so every producer and reader
 * funnels through this: absolute, platform separators, and an uppercased
 * drive letter on Windows, where `f:\` and `F:\` name the same directory.
 */
export function normalizeLibraryDirPath(dirPath: string): string {
  const resolved = path.resolve(dirPath)
  if (process.platform === 'win32' && /^[a-z]:/.test(resolved)) {
    return resolved[0]!.toUpperCase() + resolved.slice(1)
  }
  return resolved
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
