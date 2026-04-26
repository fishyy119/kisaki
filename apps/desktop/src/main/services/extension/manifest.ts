import fse from 'fs-extra'
import type {
  ExtensionManifest,
  ParsedExtensionManifest,
  ValidationIssue
} from '@kisaki/extension-api'
import { parseExtensionManifest as parseSharedExtensionManifest } from '@kisaki/extension-api'
import { resolveInsideRoot } from './shared/path-confinement'

/**
 * Parse and normalize a manifest payload into the public ExtensionManifest shape.
 */
export function parseExtensionManifest(value: unknown): ParsedExtensionManifest {
  return parseSharedExtensionManifest(value)
}

/**
 * Read and parse a manifest file from disk.
 */
export async function readExtensionManifestFile(
  manifestPath: string
): Promise<ParsedExtensionManifest> {
  const raw = await fse.readJson(manifestPath)
  return parseExtensionManifest(raw)
}

/**
 * Resolve a manifest-relative file path inside an installed extension directory.
 */
export function resolveExtensionFilePath(extensionPath: string, relativePath: string): string {
  return resolveInsideRoot(extensionPath, relativePath)
}

/**
 * Validate that a normalized relative path exists inside an extension directory.
 */
export async function validateExtensionFileExists(
  extensionPath: string,
  relativePath: string,
  fieldPath: string
): Promise<ValidationIssue[]> {
  let absolutePath: string
  try {
    absolutePath = resolveExtensionFilePath(extensionPath, relativePath)
  } catch {
    return [
      {
        path: fieldPath,
        message: 'Path must stay within the extension directory.'
      }
    ]
  }

  if (!(await fse.pathExists(absolutePath))) {
    return [
      {
        path: fieldPath,
        message: 'Referenced file does not exist.'
      }
    ]
  }

  return []
}

/**
 * Validate that an installed or staged extension package still contains
 * the files referenced by its normalized manifest.
 */
export async function validateInstalledExtensionPackage(
  extensionPath: string,
  manifest: ExtensionManifest
): Promise<ValidationIssue[]> {
  const issues = await validateExtensionFileExists(extensionPath, manifest.entry, '$.entry')

  if (manifest.icon) {
    issues.push(...(await validateExtensionFileExists(extensionPath, manifest.icon, '$.icon')))
  }

  return issues
}
