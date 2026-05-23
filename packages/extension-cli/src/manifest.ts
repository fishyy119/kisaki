import semver from 'semver'
import type { ExtensionManifest, ValidationIssue } from '@kisaki3/extension-api'
import { normalizeExtensionPackagePath, parseExtensionManifest } from '@kisaki3/extension-api'
import type { ExtensionProject } from './project'
import { pathExists, readJsonFile, resolvePackageFile } from './project'

export interface ManifestValidationOptions {
  checkEntry?: boolean
  checkProjectFiles?: boolean
}

export interface ManifestValidationResult {
  manifest: ExtensionManifest | null
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

/**
 * Reads and validates manifest.json for CLI commands.
 */
export async function validateManifest(
  project: ExtensionProject,
  options: ManifestValidationOptions = {}
): Promise<ManifestValidationResult> {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  let raw: unknown

  try {
    raw = await readJsonFile(project.manifestPath)
  } catch (error) {
    errors.push({
      path: 'manifest.json',
      message:
        error instanceof SyntaxError ? 'Manifest contains invalid JSON.' : 'Manifest not found.'
    })
    return { manifest: null, errors, warnings }
  }

  const parsed = parseExtensionManifest(raw)
  errors.push(...parsed.issues)

  if (!parsed.manifest) {
    return { manifest: null, errors, warnings }
  }

  const manifest = parsed.manifest

  if (manifest.engines?.kisaki) {
    if (semver.valid(manifest.engines.kisaki)) {
      warnings.push({
        path: '$.engines.kisaki',
        message: 'Prefer a range such as >=0.1.0 instead of a single version.'
      })
    }
  }

  const entryPath = validateRelativeFilePath(project, manifest.entry, '$.entry', errors)
  if (options.checkEntry && entryPath && !(await pathExists(entryPath))) {
    errors.push({
      path: '$.entry',
      message: 'Referenced entry file does not exist. Run kisx build first.'
    })
  }

  if (manifest.icon) {
    const iconPath = validateRelativeFilePath(project, manifest.icon, '$.icon', errors)
    if (iconPath && !(await pathExists(iconPath))) {
      errors.push({
        path: '$.icon',
        message: 'Referenced icon file does not exist.'
      })
    }
  }

  if (options.checkProjectFiles) {
    if (!(await pathExists(project.packageJsonPath))) {
      errors.push({ path: 'package.json', message: 'package.json is required.' })
    }

    if (!(await pathExists(project.tsconfigPath))) {
      warnings.push({ path: 'tsconfig.json', message: 'tsconfig.json is recommended.' })
    }

    if (!(await pathExists(project.tsdownConfigPath))) {
      errors.push({ path: 'tsdown.config.ts', message: 'tsdown.config.ts is required.' })
    }

    if (!(await pathExists(project.readmePath))) {
      warnings.push({
        path: 'README.md',
        message: 'README.md is recommended for packaged extensions.'
      })
    }
  }

  return {
    manifest: errors.length === 0 ? normalizeManifest(manifest) : null,
    errors,
    warnings
  }
}

/**
 * Loads a manifest and throws when validation fails.
 */
export async function readValidManifest(
  project: ExtensionProject,
  options: ManifestValidationOptions = {}
): Promise<ExtensionManifest> {
  const result = await validateManifest(project, options)
  if (!result.manifest) {
    throw new Error(result.errors.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
  }

  return result.manifest
}

function validateRelativeFilePath(
  project: ExtensionProject,
  value: string,
  fieldPath: string,
  errors: ValidationIssue[]
): string | null {
  if (!normalizeExtensionPackagePath(value)) {
    errors.push({
      path: fieldPath,
      message: 'Path must be relative and stay inside the extension package root.'
    })
    return null
  }

  const filePath = resolvePackageFile(project, value)
  if (!filePath) {
    errors.push({
      path: fieldPath,
      message: 'Path must stay inside the extension package root.'
    })
  }

  return filePath
}

function normalizeManifest(manifest: ExtensionManifest): ExtensionManifest {
  return {
    ...manifest,
    entry: normalizeExtensionPackagePath(manifest.entry) ?? manifest.entry,
    icon: manifest.icon
      ? (normalizeExtensionPackagePath(manifest.icon) ?? manifest.icon)
      : undefined
  }
}
