import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  extensionDebugPackageNames,
  extensionPackageDependencyFields,
  requireExtensionToolingPackage
} from './context'
import { resolveBuiltinExtensionDebugPackagesRoot } from './paths'
import { runProcess } from './process'
import type { BuiltinExtensionPackageJson, BuiltinExtensionToolContext } from './types'

/** Builds required workspace packages and mirrors debug package output. */
export async function prepareExtensionDebugPackages(
  context: BuiltinExtensionToolContext,
  outputRoot: string,
  debugSources: boolean,
  projects: readonly string[]
): Promise<void> {
  await buildExtensionPackages(context, projects)
  await copyExtensionDebugPackages(
    context,
    resolveBuiltinExtensionDebugPackagesRoot(outputRoot),
    debugSources
  )
}

async function buildExtensionPackages(
  context: BuiltinExtensionToolContext,
  projects: readonly string[]
): Promise<void> {
  const packageNames = await collectRequiredExtensionToolingPackages(context, projects)
  const packageGroups = resolveExtensionToolingBuildGroups(context, packageNames)

  for (const packageGroup of packageGroups) {
    await Promise.all(
      packageGroup.map((packageName) =>
        runProcess(context.pnpmCommand, ['--filter', packageName, 'build'], context.repoRoot)
      )
    )
  }
}

async function collectRequiredExtensionToolingPackages(
  context: BuiltinExtensionToolContext,
  projects: readonly string[]
): Promise<Set<string>> {
  const packageNames = new Set<string>()

  for (const packageName of extensionDebugPackageNames) {
    addExtensionToolingPackageWithDependencies(context, packageNames, packageName)
  }

  for (const project of projects) {
    const packageJson = JSON.parse(
      await readFile(path.join(project, 'package.json'), 'utf8')
    ) as BuiltinExtensionPackageJson

    for (const dependencyField of extensionPackageDependencyFields) {
      const dependencies = packageJson[dependencyField]
      if (!dependencies) {
        continue
      }

      for (const [packageName, versionRange] of Object.entries(dependencies)) {
        if (
          versionRange === 'workspace:*' &&
          context.extensionToolingPackagesByName.has(packageName)
        ) {
          addExtensionToolingPackageWithDependencies(context, packageNames, packageName)
        }
      }
    }
  }

  return packageNames
}

function addExtensionToolingPackageWithDependencies(
  context: BuiltinExtensionToolContext,
  packageNames: Set<string>,
  packageName: string
): void {
  if (packageNames.has(packageName)) {
    return
  }

  packageNames.add(packageName)

  for (const dependencyName of context.extensionToolingManifest.internalDependencies[packageName] ??
    []) {
    addExtensionToolingPackageWithDependencies(context, packageNames, dependencyName)
  }
}

function resolveExtensionToolingBuildGroups(
  context: BuiltinExtensionToolContext,
  packageNames: ReadonlySet<string>
): readonly (readonly string[])[] {
  const packageGroups: string[][] = context.extensionToolingManifest.buildPackageGroups
    .map((packageGroup) => [...packageGroup].filter((packageName) => packageNames.has(packageName)))
    .filter((packageGroup) => packageGroup.length > 0)

  const groupedPackageNames = new Set(packageGroups.flat())
  const missingPackageNames = [...packageNames].filter(
    (packageName) => !groupedPackageNames.has(packageName)
  )

  if (missingPackageNames.length > 0) {
    throw new Error(
      `Missing extension tooling build group for package(s): ${missingPackageNames.join(', ')}`
    )
  }

  return packageGroups
}

async function copyExtensionDebugPackages(
  context: BuiltinExtensionToolContext,
  debugPackagesRoot: string,
  debugSources: boolean
): Promise<void> {
  await rm(debugPackagesRoot, { recursive: true, force: true })

  for (const packageName of extensionDebugPackageNames) {
    const toolingPackage = requireExtensionToolingPackage(context, packageName)
    const sourceDir = path.join(context.repoRoot, toolingPackage.dir, 'dist')
    const targetDir = path.join(debugPackagesRoot, path.basename(toolingPackage.dir), 'dist')
    await mkdir(path.dirname(targetDir), { recursive: true })
    await cp(sourceDir, targetDir, { recursive: true })
    if (debugSources) {
      await rewriteCopiedDistSourceMaps(sourceDir, targetDir)
    }
  }
}

async function rewriteCopiedDistSourceMaps(
  sourceDistDir: string,
  targetDistDir: string
): Promise<void> {
  const entries = await readdir(targetDistDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(sourceDistDir, entry.name)
    const targetPath = path.join(targetDistDir, entry.name)

    if (entry.isDirectory()) {
      await rewriteCopiedDistSourceMaps(sourcePath, targetPath)
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.map')) {
      await rewriteSourceMapSourceRoot(targetPath, sourceDistDir)
    }
  }
}

async function rewriteSourceMapSourceRoot(mapPath: string, originalMapDir: string): Promise<void> {
  const sourceMap = JSON.parse(await readFile(mapPath, 'utf8')) as Record<string, unknown>
  sourceMap.sourceRoot = toDirectoryFileUrl(originalMapDir)
  await writeFile(mapPath, `${JSON.stringify(sourceMap)}\n`)
}

function toDirectoryFileUrl(directoryPath: string): string {
  const directoryWithSeparator = directoryPath.endsWith(path.sep)
    ? directoryPath
    : `${directoryPath}${path.sep}`
  return pathToFileURL(directoryWithSeparator).href
}
