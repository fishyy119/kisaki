import path from 'node:path'
import { cp, mkdir, readdir, readFile, realpath } from 'node:fs/promises'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import { CliError } from '../errors'
import {
  pathExists,
  readExtensionRuntimeDependencies,
  resolvePackageFile,
  type ExtensionRuntimeDependency,
  type ExtensionProject
} from '../project'

const NODE_MODULES_DIR = 'node_modules'
const PUBLISH_ARTIFACT_EXTENSIONS = new Set(['.kisx', '.sig'])

interface PackageJson {
  dependencies?: Record<string, unknown>
  optionalDependencies?: Record<string, unknown>
}

interface DependencyCopyContext {
  copiedPackageTargets: Set<string>
  copiedPackageTrees: Set<string>
}

interface CopyDependencyTreeInput {
  name: string
  fromDir: string
  targetNodeModulesDir: string
  optional: boolean
  ancestors: ReadonlySet<string>
  context: DependencyCopyContext
}

/** One source file and its normalized path inside an extension package. */
export interface ExtensionPackageFileEntry {
  readonly filePath: string
  readonly packagePath: string
}

/** Materializes the validated extension package layout in a target directory. */
export async function copyExtensionPackageFiles(
  project: ExtensionProject,
  manifest: ExtensionManifest,
  packagePath: string
): Promise<void> {
  await cp(project.manifestPath, path.join(packagePath, 'manifest.json'))
  await cp(project.distDir, path.join(packagePath, 'dist'), { recursive: true })
  await copyOptionalPackageFiles(project, manifest, packagePath)
  await copyProductionDependencies(project, packagePath)
}

/** Collects package files in deterministic archive order. */
export async function collectExtensionPackageFileEntries(
  packageRoot: string
): Promise<readonly ExtensionPackageFileEntry[]> {
  const entries: ExtensionPackageFileEntry[] = []
  await collectExtensionPackageFileEntriesInto(packageRoot, '', entries)
  return entries.toSorted((left, right) => compareStrings(left.packagePath, right.packagePath))
}

async function copyOptionalPackageFiles(
  project: ExtensionProject,
  manifest: ExtensionManifest,
  packagePath: string
): Promise<void> {
  if (await pathExists(project.readmePath)) {
    await cp(project.readmePath, path.join(packagePath, 'README.md'))
  }

  if (manifest.icon) {
    const iconPath = resolvePackageFile(project, manifest.icon)
    if (iconPath && (await pathExists(iconPath))) {
      const targetPath = resolvePackageOutputPath(packagePath, manifest.icon)
      await mkdir(path.dirname(targetPath), { recursive: true })
      await cp(iconPath, targetPath)
    }
  }
}

async function copyProductionDependencies(
  project: ExtensionProject,
  packagePath: string
): Promise<void> {
  const dependencies = await readExtensionRuntimeDependencies(project)

  if (dependencies.length === 0) {
    return
  }

  const context: DependencyCopyContext = {
    copiedPackageTargets: new Set(),
    copiedPackageTrees: new Set()
  }
  const targetNodeModulesDir = path.join(packagePath, NODE_MODULES_DIR)

  for (const dependency of dependencies) {
    await copyDependencyTree({
      name: dependency.name,
      fromDir: project.rootDir,
      targetNodeModulesDir,
      optional: dependency.optional,
      ancestors: new Set(),
      context
    })
  }
}

async function copyDependencyTree(input: CopyDependencyTreeInput): Promise<void> {
  const sourcePackageDir = await resolveInstalledPackageDir(input.name, input.fromDir)

  if (!sourcePackageDir) {
    if (input.optional) {
      return
    }

    throw new CliError(`Runtime dependency "${input.name}" is not installed.`)
  }

  const resolvedSourcePackageDir = await realpath(sourcePackageDir)
  const targetPackageDir = path.join(
    input.targetNodeModulesDir,
    ...getPackageNamePathSegments(input.name)
  )
  const treeKey = `${targetPackageDir}\0${resolvedSourcePackageDir}`

  if (input.context.copiedPackageTrees.has(treeKey)) {
    return
  }
  input.context.copiedPackageTrees.add(treeKey)

  if (!input.context.copiedPackageTargets.has(targetPackageDir)) {
    await mkdir(path.dirname(targetPackageDir), { recursive: true })
    await cp(resolvedSourcePackageDir, targetPackageDir, {
      recursive: true,
      dereference: true,
      filter: (source) => shouldCopyPackagePath(resolvedSourcePackageDir, source)
    })
    input.context.copiedPackageTargets.add(targetPackageDir)
  }

  if (input.ancestors.has(resolvedSourcePackageDir)) {
    return
  }

  const packageJson = await readPackageJson(path.join(resolvedSourcePackageDir, 'package.json'))
  const dependencies = readPackageRuntimeDependencies(packageJson)
  const nextAncestors = new Set(input.ancestors)
  nextAncestors.add(resolvedSourcePackageDir)

  for (const dependency of dependencies) {
    await copyDependencyTree({
      name: dependency.name,
      fromDir: resolvedSourcePackageDir,
      targetNodeModulesDir: path.join(targetPackageDir, NODE_MODULES_DIR),
      optional: dependency.optional,
      ancestors: nextAncestors,
      context: input.context
    })
  }
}

async function resolveInstalledPackageDir(
  packageName: string,
  fromDir: string
): Promise<string | null> {
  const packagePathSegments = getPackageNamePathSegments(packageName)
  let currentDir = path.resolve(fromDir)

  while (true) {
    const candidate = path.join(currentDir, NODE_MODULES_DIR, ...packagePathSegments)
    if (await pathExists(path.join(candidate, 'package.json'))) {
      return candidate
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      return null
    }

    currentDir = parentDir
  }
}

function readPackageRuntimeDependencies(
  packageJson: PackageJson
): readonly ExtensionRuntimeDependency[] {
  return readRuntimeDependencies(packageJson)
}

function readRuntimeDependencies(packageJson: PackageJson): readonly ExtensionRuntimeDependency[] {
  const dependencies = new Map<string, ExtensionRuntimeDependency>()
  addRuntimeDependencies(dependencies, packageJson.dependencies, false)
  addRuntimeDependencies(dependencies, packageJson.optionalDependencies, true)
  return [...dependencies.values()].toSorted((left, right) => compareStrings(left.name, right.name))
}

function addRuntimeDependencies(
  dependencies: Map<string, ExtensionRuntimeDependency>,
  values: Record<string, unknown> | undefined,
  optional: boolean
): void {
  if (!values) {
    return
  }

  for (const [name, spec] of Object.entries(values)) {
    if (typeof spec !== 'string') {
      continue
    }

    dependencies.set(name, {
      name,
      optional: optional || dependencies.get(name)?.optional === true,
      spec
    })
  }
}

async function readPackageJson(filePath: string): Promise<PackageJson> {
  const value = JSON.parse(await readFile(filePath, 'utf8')) as unknown

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CliError(`${filePath} must contain a JSON object.`)
  }

  return value as PackageJson
}

function shouldCopyPackagePath(packageRoot: string, sourcePath: string): boolean {
  const relativePath = path.relative(packageRoot, sourcePath)
  if (!relativePath) {
    return true
  }

  const segments = relativePath.split(path.sep)
  return !segments.includes(NODE_MODULES_DIR) && !segments.includes('.git')
}

function getPackageNamePathSegments(packageName: string): readonly string[] {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(packageName)) {
    throw new CliError(`Invalid runtime dependency package name: ${packageName}`)
  }
  const segments = packageName.split('/')

  if (packageName.startsWith('@')) {
    return segments.slice(0, 2)
  }

  return [segments[0] ?? packageName]
}

async function collectExtensionPackageFileEntriesInto(
  currentDir: string,
  packageDir: string,
  entries: ExtensionPackageFileEntry[]
): Promise<void> {
  const dirents = (await readdir(currentDir, { withFileTypes: true })).toSorted((left, right) =>
    compareStrings(left.name, right.name)
  )

  for (const dirent of dirents) {
    const filePath = path.join(currentDir, dirent.name)
    const packagePath = packageDir ? path.posix.join(packageDir, dirent.name) : dirent.name

    if (dirent.isDirectory()) {
      await collectExtensionPackageFileEntriesInto(filePath, packagePath, entries)
      continue
    }

    if (dirent.isFile() && shouldIncludePackageEntry(packagePath)) {
      entries.push({ filePath, packagePath })
    }
  }
}

function shouldIncludePackageEntry(entryName: string): boolean {
  return !PUBLISH_ARTIFACT_EXTENSIONS.has(path.extname(entryName).toLowerCase())
}

function resolvePackageOutputPath(packagePath: string, relativePath: string): string {
  const root = path.resolve(packagePath)
  const target = path.resolve(root, relativePath)
  const relative = path.relative(root, target)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new CliError(`Package output path escapes the extension package: ${relativePath}`)
  }

  return target
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1
  }

  if (left > right) {
    return 1
  }

  return 0
}
