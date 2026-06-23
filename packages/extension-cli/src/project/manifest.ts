import semver from 'semver'
import type { ExtensionManifest, ValidationIssue } from '@kisaki3/extension-api'
import {
  EXTENSION_API_VERSION,
  getRecommendedExtensionApiRange,
  normalizeExtensionPackagePath,
  parseExtensionManifest
} from '@kisaki3/extension-api'
import { CliError } from '../errors'
import { BUNDLED_EXTENSION_PACKAGES } from './dependencies'
import type { ExtensionProject } from './model'
import { pathExists, readJsonFile, resolvePackageFile } from './model'

/** Controls filesystem checks performed alongside manifest schema validation. */
export interface ManifestValidationOptions {
  checkBuiltEntry?: boolean
  checkBuiltUi?: boolean
  checkProjectFiles?: boolean
}

/** Parsed manifest plus actionable project errors and warnings. */
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

  const kisakiApiRange = manifest.engines.kisaki.trim()
  if (!kisakiApiRange) {
    errors.push({
      path: '$.engines.kisaki',
      message: 'engines.kisaki is required and must declare an Extension API version range.'
    })
  } else {
    const recommendedRange = getRecommendedExtensionApiRange(EXTENSION_API_VERSION)
    if (!semver.subset(kisakiApiRange, recommendedRange, { includePrerelease: true })) {
      warnings.push({
        path: '$.engines.kisaki',
        message: `Range extends beyond the official Extension API compatibility recommendation for ${EXTENSION_API_VERSION}; recommended range is ${recommendedRange}.`
      })
    }
  }

  const entryPath = validateRelativeFilePath(project, manifest.entry, '$.entry', errors)
  if (options.checkBuiltEntry && entryPath && !(await pathExists(entryPath))) {
    errors.push({
      path: '$.entry',
      message: 'Referenced entry file does not exist. Run kisx build first.'
    })
  }

  if (manifest.ui) {
    const uiPath = validateRelativeFilePath(project, manifest.ui, '$.ui', errors)
    if (options.checkBuiltUi && uiPath && !(await pathExists(uiPath))) {
      errors.push({
        path: '$.ui',
        message: 'Referenced ui directory does not exist. Run kisx build first.'
      })
    }
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
    } else {
      const packageJson = await readProjectPackageJson(project, errors)
      if (packageJson) {
        validateProjectPackageJson(packageJson, errors)
        checkUiKitDependencies(packageJson, warnings)
      }
    }

    if (!(await pathExists(project.tsconfigPath))) {
      warnings.push({ path: 'tsconfig.json', message: 'tsconfig.json is recommended.' })
    }

    if (!(await pathExists(project.entrySourcePath))) {
      errors.push({
        path: 'src/host/index.ts',
        message: 'Host entry source src/host/index.ts is required.'
      })
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

const UI_KIT_PACKAGE = '@kisaki3/extension-ui-vue'
const ICONIFY_PLUGIN_PACKAGE = '@iconify/tailwind4'
const ICONIFY_DATA_PACKAGES = ['@iconify-json/mdi', '@iconify/json']

/**
 * Warns when a project uses the UI kit without the iconify build setup. The
 * kit renders icons via iconify mask classes (e.g. `icon-[mdi--close]`), which
 * the consumer's Tailwind build only emits when the plugin and an icon-set
 * data package are installed — otherwise the kit's icons silently render blank.
 */
function checkUiKitDependencies(packageJson: unknown, warnings: ValidationIssue[]): void {
  const dependencies = collectDependencyNames(packageJson)
  if (!dependencies.has(UI_KIT_PACKAGE)) {
    return
  }

  if (!dependencies.has(ICONIFY_PLUGIN_PACKAGE)) {
    warnings.push({
      path: 'package.json',
      message: `${UI_KIT_PACKAGE} renders icons via iconify mask classes, but ${ICONIFY_PLUGIN_PACKAGE} is not installed. Add it and an icon set (e.g. @iconify-json/mdi), and register \`@plugin "${ICONIFY_PLUGIN_PACKAGE}"\` in the webview document CSS, or the kit icons render blank.`
    })
    return
  }

  if (!ICONIFY_DATA_PACKAGES.some((name) => dependencies.has(name))) {
    warnings.push({
      path: 'package.json',
      message: `${UI_KIT_PACKAGE} uses mdi icons, but no iconify icon-set data package is installed. Add @iconify-json/mdi (or @iconify/json), or the kit icons render blank.`
    })
  }
}

async function readProjectPackageJson(
  project: ExtensionProject,
  errors: ValidationIssue[]
): Promise<unknown | null> {
  try {
    return await readJsonFile(project.packageJsonPath)
  } catch {
    errors.push({ path: 'package.json', message: 'package.json must contain valid JSON.' })
    return null
  }
}

function validateProjectPackageJson(packageJson: unknown, errors: ValidationIssue[]): void {
  if (!packageJson || typeof packageJson !== 'object' || Array.isArray(packageJson)) {
    errors.push({ path: 'package.json', message: 'package.json must contain a JSON object.' })
    return
  }

  const record = packageJson as Record<string, unknown>
  if (typeof record.name !== 'string' || !matchesPackageNameFormat(record.name)) {
    errors.push({
      path: 'package.json#name',
      message: 'name must be a lowercase npm package name.'
    })
  }
  if (record.private !== true) {
    errors.push({ path: 'package.json#private', message: 'Extension packages must be private.' })
  }
  if ('version' in record) {
    errors.push({
      path: 'package.json#version',
      message:
        'Remove package.json version; manifest.json is the extension version source of truth.'
    })
  }

  validateRuntimeDependencies(record, errors)
}

function validateRuntimeDependencies(
  packageJson: Record<string, unknown>,
  errors: ValidationIssue[]
): void {
  for (const field of ['dependencies', 'optionalDependencies']) {
    const dependencies = packageJson[field]
    if (dependencies === undefined) {
      continue
    }
    if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
      errors.push({ path: `package.json#${field}`, message: `${field} must be a JSON object.` })
      continue
    }
    for (const [name, spec] of Object.entries(dependencies)) {
      if (!matchesPackageNameFormat(name)) {
        errors.push({
          path: `package.json#${field}.${name}`,
          message: 'Dependency name must be a lowercase npm package name.'
        })
        continue
      }
      if (typeof spec !== 'string' || !spec.trim()) {
        errors.push({
          path: `package.json#${field}.${name}`,
          message: 'Dependency version must be a non-empty string.'
        })
        continue
      }
      if (BUNDLED_EXTENSION_PACKAGES.has(name)) {
        errors.push({
          path: `package.json#${field}.${name}`,
          message: `${name} is bundled into the host output and must be declared in devDependencies, not ${field}.`
        })
        continue
      }
      if (spec.startsWith('workspace:')) {
        errors.push({
          path: `package.json#${field}.${name}`,
          message:
            'Runtime workspace dependencies cannot be packaged; publish with a concrete version, or bundle the dependency into the host output and move it to devDependencies.'
        })
      }
    }
  }
}

function matchesPackageNameFormat(value: string): boolean {
  return value.length <= 214 && /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value)
}

function collectDependencyNames(packageJson: unknown): Set<string> {
  const names = new Set<string>()
  if (typeof packageJson !== 'object' || packageJson === null) {
    return names
  }

  const record = packageJson as Record<string, unknown>
  for (const field of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies'
  ]) {
    const group = record[field]
    if (typeof group === 'object' && group !== null) {
      for (const name of Object.keys(group)) {
        names.add(name)
      }
    }
  }

  return names
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
    throw new CliError(result.errors.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
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
  const normalized: ExtensionManifest = {
    ...manifest,
    entry: normalizeExtensionPackagePath(manifest.entry) ?? manifest.entry
  }

  if (manifest.ui) {
    normalized.ui = normalizeExtensionPackagePath(manifest.ui) ?? manifest.ui
  }

  if (manifest.icon) {
    normalized.icon = normalizeExtensionPackagePath(manifest.icon) ?? manifest.icon
  }

  return normalized
}
