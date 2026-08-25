/**
 * Manifest parsing shared by the main process and the extension host.
 *
 * Both processes read the same `kisaki.json` and must agree on what it means,
 * so parsing and path resolution live here. Filesystem access stays with the
 * caller: the main process owns installation-time validation, and the host
 * reads the manifest of the extension it is about to load.
 */

import type { ParsedExtensionManifest } from '@kisaki3/extension-api'
import { parseExtensionManifest as parseSharedExtensionManifest } from '@kisaki3/extension-api'
import { resolveInsideRoot } from './path-confinement'

export function parseExtensionManifest(value: unknown): ParsedExtensionManifest {
  return parseSharedExtensionManifest(value)
}

export function resolveExtensionFilePath(extensionPath: string, relativePath: string): string {
  return resolveInsideRoot(extensionPath, relativePath)
}
