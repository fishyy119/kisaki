/**
 * Path containment math shared by every process.
 */

import path from 'node:path'

/** Returns whether a candidate path is the root itself or lives under it. */
export function isInsideOrEqualPath(rootDir: string, candidatePath: string): boolean {
  const root = path.resolve(rootDir)
  const candidate = path.resolve(candidatePath)
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}
