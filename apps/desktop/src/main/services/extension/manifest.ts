import path from 'node:path'
import semver from 'semver'
import fse from 'fs-extra'
import type { ExtensionManifest, ValidationIssue } from '@kisaki/extension-api'
import { validateExtensionManifestShape } from '@kisaki/extension-api'
import type { ParsedExtensionManifest } from './types'

/**
 * Parse and normalize a manifest payload into the public ExtensionManifest shape.
 */
export function parseExtensionManifest(value: unknown): ParsedExtensionManifest {
  const issues = [...validateExtensionManifestShape(value)]

  if (issues.length > 0) {
    return { manifest: null, issues }
  }

  const manifest = value as ExtensionManifest

  if (!semver.valid(manifest.version)) {
    issues.push({
      path: '$.version',
      message: 'version must be a valid semver string.'
    })
  }

  if (manifest.engines?.kisaki && !semver.validRange(manifest.engines.kisaki)) {
    issues.push({
      path: '$.engines.kisaki',
      message: 'engines.kisaki must be a valid semver range.'
    })
  }

  const normalizedEntry = normalizeManifestRelativePath(manifest.entry, '$.entry', issues)
  const normalizedIcon =
    manifest.icon === undefined
      ? undefined
      : normalizeManifestRelativePath(manifest.icon, '$.icon', issues)

  if (issues.length > 0 || !normalizedEntry) {
    return { manifest: null, issues }
  }

  return {
    manifest: {
      ...manifest,
      entry: normalizedEntry,
      icon: normalizedIcon ?? undefined
    },
    issues
  }
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
  return path.resolve(extensionPath, relativePath)
}

/**
 * Validate that a normalized relative path exists inside an extension directory.
 */
export async function validateExtensionFileExists(
  extensionPath: string,
  relativePath: string,
  fieldPath: string
): Promise<ValidationIssue[]> {
  const absolutePath = resolveExtensionFilePath(extensionPath, relativePath)
  const relative = path.relative(extensionPath, absolutePath)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
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

function normalizeManifestRelativePath(
  value: string,
  fieldPath: string,
  issues: ValidationIssue[]
): string | null {
  const normalized = path.posix.normalize(value.replace(/\\/g, '/'))

  if (!normalized || normalized === '.' || normalized === '..') {
    issues.push({
      path: fieldPath,
      message: 'Path must point to a file inside the extension package.'
    })
    return null
  }

  if (normalized.startsWith('../') || normalized === '..') {
    issues.push({
      path: fieldPath,
      message: 'Path must not escape the extension package root.'
    })
    return null
  }

  if (path.posix.isAbsolute(normalized) || /^[A-Za-z]:[\\/]/.test(value)) {
    issues.push({
      path: fieldPath,
      message: 'Path must be relative to the extension package root.'
    })
    return null
  }

  return normalized.startsWith('./') ? normalized.slice(2) : normalized
}
