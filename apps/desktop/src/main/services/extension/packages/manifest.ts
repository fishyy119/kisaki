import fse from 'fs-extra'
import type {
  ExtensionManifest,
  ParsedExtensionManifest,
  ValidationIssue
} from '@kisaki3/extension-api'
import { parseExtensionManifest as parseSharedExtensionManifest } from '@kisaki3/extension-api'
import { resolveInsideRoot } from '../shared/path-confinement'

export function parseExtensionManifest(value: unknown): ParsedExtensionManifest {
  return parseSharedExtensionManifest(value)
}

export async function readExtensionManifestFile(
  manifestPath: string
): Promise<ParsedExtensionManifest> {
  const raw = await fse.readJson(manifestPath)
  return parseExtensionManifest(raw)
}

export function resolveExtensionFilePath(extensionPath: string, relativePath: string): string {
  return resolveInsideRoot(extensionPath, relativePath)
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
