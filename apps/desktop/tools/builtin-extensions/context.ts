import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  BuiltinExtensionToolContext,
  ExtensionToolingManifest,
  ExtensionToolingPackage
} from './types'

export const extensionDebugPackageNames = [
  '@kisaki3/extension-api',
  '@kisaki3/extension-sdk'
] as const

/** Workspace packages the desktop workflows load in-process to run kisx builds. */
export const kisxRuntimePackageNames = ['@kisaki3/extension-cli'] as const

export const extensionPackageDependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies'
] as const

/** Creates the repository path context used by built-in extension workflows. */
export function createBuiltinExtensionToolContext(
  metaUrl = import.meta.url
): BuiltinExtensionToolContext {
  const toolDir = path.dirname(fileURLToPath(metaUrl))
  const desktopRoot = path.resolve(toolDir, '..', '..')
  const repoRoot = path.resolve(desktopRoot, '..', '..')
  const extensionToolingManifest = readExtensionToolingManifest(repoRoot)
  const extensionToolingPackagesByName = new Map(
    extensionToolingManifest.packages.map((toolingPackage) => [toolingPackage.name, toolingPackage])
  )

  return {
    desktopRoot,
    repoRoot,
    builtinExtensionsRoot: path.join(repoRoot, 'extensions'),
    extensionToolingManifest,
    extensionToolingPackagesByName,
    pnpmCommand: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  }
}

function readExtensionToolingManifest(repoRoot: string): ExtensionToolingManifest {
  const manifestPath = path.join(repoRoot, 'packages', 'extension-tooling-manifest.json')
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as ExtensionToolingManifest
}

/** Returns an extension tooling package from the repository manifest. */
export function requireExtensionToolingPackage(
  context: BuiltinExtensionToolContext,
  packageName: string
): ExtensionToolingPackage {
  const toolingPackage = context.extensionToolingPackagesByName.get(packageName)
  if (!toolingPackage) {
    throw new Error(`Unknown extension tooling package: ${packageName}`)
  }

  return toolingPackage
}
