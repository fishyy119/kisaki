import { resolveInsideRoot } from '../../../../shared/path-confinement'

/**
 * Resolves an extension-relative path while preventing directory escape.
 */
export function resolveInsideExtension(extensionPath: string, relativePath: string): string {
  return resolveInsideRoot(extensionPath, relativePath)
}
