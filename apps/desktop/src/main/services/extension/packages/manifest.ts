/**
 * Filesystem side of manifest handling: reads and installation-time checks.
 * Parsing and path resolution live in `@shared/extension/manifest`.
 */

import { readFile } from 'node:fs/promises'
// Import the fs module directly: the utils barrel links Electron main-process
// modules, which must stay out of the extension host utility process bundle.
import { pathExists } from '@main/utils/fs'
import type {
  ExtensionManifest,
  ParsedExtensionManifest,
  ValidationIssue
} from '@kisaki3/extension-api'
import { parseExtensionManifest, resolveExtensionFilePath } from '@shared/extension/manifest'

export async function readExtensionManifestFile(
  manifestPath: string
): Promise<ParsedExtensionManifest> {
  const raw = JSON.parse(await readFile(manifestPath, 'utf8'))
  return parseExtensionManifest(raw)
}

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

  if (!(await pathExists(absolutePath))) {
    return [
      {
        path: fieldPath,
        message: 'Referenced file does not exist.'
      }
    ]
  }

  return []
}

export async function validateInstalledExtensionPackage(
  extensionPath: string,
  manifest: ExtensionManifest
): Promise<ValidationIssue[]> {
  const issues = await validateExtensionFileExists(extensionPath, manifest.entry, '$.entry')

  if (manifest.ui) {
    issues.push(...(await validateExtensionFileExists(extensionPath, manifest.ui, '$.ui')))
  }

  if (manifest.icon) {
    issues.push(...(await validateExtensionFileExists(extensionPath, manifest.icon, '$.icon')))
  }

  return issues
}
