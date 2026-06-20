import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export interface ToolingPackage {
  readonly name: string
  readonly dir: string
}

export interface ToolingManifest {
  readonly packages: readonly ToolingPackage[]
  readonly internalDependencies: Record<string, readonly string[]>
  readonly buildPackageGroups: readonly (readonly string[])[]
  readonly outputPaths: readonly string[]
}

export interface ToolingWorkspace {
  readonly root: string
  readonly manifest: ToolingManifest
}

const toolingManifestPath = 'packages/extension-tooling-manifest.json'

export function loadToolingWorkspace(startDir: string): ToolingWorkspace {
  const root = findRepositoryRoot(startDir)
  return {
    root,
    manifest: readWorkspaceJson({ root }, toolingManifestPath)
  }
}

export function resolveWorkspacePath(
  workspace: Pick<ToolingWorkspace, 'root'>,
  relativePath: string
): string {
  return path.resolve(workspace.root, relativePath)
}

export function readWorkspaceText(
  workspace: Pick<ToolingWorkspace, 'root'>,
  relativePath: string
): string {
  const fullPath = resolveWorkspacePath(workspace, relativePath)
  if (!existsSync(fullPath)) {
    throw new Error(`Missing file: ${relativePath}`)
  }
  return readFileSync(fullPath, 'utf-8')
}

export function readWorkspaceJson<T>(
  workspace: Pick<ToolingWorkspace, 'root'>,
  relativePath: string
): T {
  return JSON.parse(readWorkspaceText(workspace, relativePath)) as T
}

export function writeWorkspaceText(
  workspace: Pick<ToolingWorkspace, 'root'>,
  relativePath: string,
  value: string
): void {
  writeFileSync(resolveWorkspacePath(workspace, relativePath), value, 'utf-8')
}

export function writeWorkspaceJson(
  workspace: Pick<ToolingWorkspace, 'root'>,
  relativePath: string,
  value: unknown
): void {
  writeWorkspaceText(workspace, relativePath, `${JSON.stringify(value, null, 2)}\n`)
}

export function getPackageDirectory(
  workspace: Pick<ToolingWorkspace, 'root'>,
  toolingPackage: ToolingPackage
): string {
  return resolveWorkspacePath(workspace, toolingPackage.dir)
}

export function getPackageJsonPath(toolingPackage: ToolingPackage): string {
  return path.join(toolingPackage.dir, 'package.json')
}

export function requireToolingPackage(
  workspace: ToolingWorkspace,
  packageName: string
): ToolingPackage {
  const toolingPackage = workspace.manifest.packages.find(
    (candidate) => candidate.name === packageName
  )
  if (!toolingPackage) {
    throw new Error(`Unknown extension tooling package: ${packageName}`)
  }
  return toolingPackage
}

function findRepositoryRoot(startDir: string): string {
  let currentDir = path.resolve(startDir)

  while (true) {
    if (
      existsSync(path.join(currentDir, 'pnpm-workspace.yaml')) &&
      existsSync(path.join(currentDir, 'package.json'))
    ) {
      return currentDir
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      throw new Error('Could not find Kisaki repository root.')
    }
    currentDir = parentDir
  }
}
