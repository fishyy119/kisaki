import path from 'node:path'
import { access, readFile } from 'node:fs/promises'
import { normalizeExtensionPackagePath, type ExtensionManifest } from '@kisaki/extension-api'

export interface ExtensionProject {
  rootDir: string
  manifestPath: string
  packageJsonPath: string
  tsconfigPath: string
  tsdownConfigPath: string
  readmePath: string
  distDir: string
  assetsDir: string
}

/**
 * Finds the nearest extension project root by walking up to manifest.json.
 */
export async function resolveProject(startDir = process.cwd()): Promise<ExtensionProject> {
  const rootDir = await findProjectRoot(path.resolve(startDir))

  return {
    rootDir,
    manifestPath: path.join(rootDir, 'manifest.json'),
    packageJsonPath: path.join(rootDir, 'package.json'),
    tsconfigPath: path.join(rootDir, 'tsconfig.json'),
    tsdownConfigPath: path.join(rootDir, 'tsdown.config.ts'),
    readmePath: path.join(rootDir, 'README.md'),
    distDir: path.join(rootDir, 'dist'),
    assetsDir: path.join(rootDir, 'assets')
  }
}

/**
 * Reads a UTF-8 JSON file.
 */
export async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, 'utf-8')
  return JSON.parse(raw)
}

/**
 * Resolves an extension package-relative path while keeping it inside the project.
 */
export function resolvePackageFile(project: ExtensionProject, relativePath: string): string | null {
  const normalized = normalizeExtensionPackagePath(relativePath)
  if (!normalized) {
    return null
  }

  const absolutePath = path.resolve(project.rootDir, normalized)
  const relative = path.relative(project.rootDir, absolutePath)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null
  }

  return absolutePath
}

/**
 * Resolves the current manifest entry path on disk.
 */
export function resolveEntryFile(
  project: ExtensionProject,
  manifest: Pick<ExtensionManifest, 'entry'>
): string | null {
  return resolvePackageFile(project, manifest.entry)
}

/**
 * Checks whether a file or directory exists.
 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function findProjectRoot(startDir: string): Promise<string> {
  let current = startDir

  while (true) {
    if (await pathExists(path.join(current, 'manifest.json'))) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current) {
      throw new Error('Could not find manifest.json. Run kisx inside an extension project.')
    }

    current = parent
  }
}
