import path from 'node:path'

/**
 * Resolves an extension-relative path while preventing directory escape.
 */
export function resolveInsideExtension(extensionPath: string, relativePath: string): string {
  const absolutePath = path.resolve(extensionPath, relativePath)
  const relative = path.relative(extensionPath, absolutePath)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Extension paths must stay within the extension directory')
  }

  return absolutePath
}
