import path from 'node:path'
import { mkdir, readdir, readFile, rename, rm, rmdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import { CliError } from '../logger'
import { pathExists, type ExtensionProject } from '../project'
import { copyExtensionPackageFiles } from '../packaging'

export const CURRENT_OUTPUT_FILE = 'current.json'
export const OUTPUT_VERSIONS_DIR = 'versions'

const OUTPUT_STAGING_DIR = '.staging'
const OUTPUT_VERSION_RETAIN_COUNT = 20

let outputBuildSequence = 0

/**
 * Webview UI delivery declared in the publication pointer. Absent means
 * bundled assets inside the package.
 */
export interface ExtensionOutputUiDelivery {
  mode: 'dev-server'
  origin: string
}

export interface ExtensionOutputOptions {
  outDir: string
  debugSources?: boolean
  skipInitialBuild?: boolean
  ui?: ExtensionOutputUiDelivery
}

export interface ExtensionOutputResult {
  manifest: ExtensionManifest
  packagePath: string
  publicationPath: string
}

export interface PublishedPackageOutput {
  packagePath: string
  publicationPath: string
}

interface CurrentOutputDocument {
  schemaVersion: 1
  extensionId: string
  version: string
  buildId: string
  packagePath: string
  publishedAt: string
  ui?: ExtensionOutputUiDelivery
}

/**
 * Publishes the built dist as an immutable unpacked package version and
 * atomically updates the `current.json` pointer.
 */
export async function writeExtensionPackageOutput(
  project: ExtensionProject,
  manifest: ExtensionManifest,
  options: ExtensionOutputOptions
): Promise<PublishedPackageOutput> {
  const outputRoot = path.resolve(project.rootDir, options.outDir)
  const publicationPath = path.join(outputRoot, manifest.id)
  const buildId = createOutputBuildId()
  const stagingPath = path.join(publicationPath, OUTPUT_STAGING_DIR, buildId)
  const packagePath = path.join(publicationPath, OUTPUT_VERSIONS_DIR, buildId)

  await removePath(stagingPath)
  await mkdir(stagingPath, { recursive: true })

  try {
    await copyExtensionPackageFiles(project, manifest, stagingPath)
    if (options.debugSources) {
      await rewriteCopiedDistSourceMaps(project.distDir, path.join(stagingPath, 'dist'))
    }

    await mkdir(path.dirname(packagePath), { recursive: true })
    await retryFileSystemOperation(() => rename(stagingPath, packagePath))
    await writeCurrentOutputDocument(publicationPath, manifest, {
      buildId,
      packagePath,
      ...(options.ui === undefined ? {} : { ui: options.ui })
    })
    await removeEmptyDirectory(path.dirname(stagingPath)).catch(() => undefined)
    await cleanupPublishedVersions(publicationPath, buildId).catch(() => undefined)
    return { packagePath, publicationPath }
  } catch (error) {
    await removePath(stagingPath).catch(() => undefined)
    throw error
  }
}

/**
 * Resolves the package directory of an existing publication, verifying the
 * pointer integrity for the expected extension.
 */
export async function readCurrentPackageOutputPath(
  publicationPath: string,
  extensionId: string
): Promise<string> {
  const documentPath = path.join(publicationPath, CURRENT_OUTPUT_FILE)

  if (!(await pathExists(documentPath))) {
    throw new CliError('Existing package output is not ready yet.')
  }

  const document = JSON.parse(await readFile(documentPath, 'utf8')) as Record<string, unknown>
  if (document.schemaVersion !== 1) {
    throw new CliError('Existing package output uses an unknown current.json schema.')
  }

  if (document.extensionId !== extensionId) {
    throw new CliError('Existing package output belongs to another extension.')
  }

  if (typeof document.packagePath !== 'string' || document.packagePath.trim().length === 0) {
    throw new CliError('Existing package output is missing a package path.')
  }

  const packagePath = resolveOutputRelativePath(publicationPath, document.packagePath)
  if (!(await pathExists(path.join(packagePath, 'manifest.json')))) {
    throw new CliError('Existing package output is not ready yet.')
  }

  return packagePath
}

async function writeCurrentOutputDocument(
  publicationPath: string,
  manifest: ExtensionManifest,
  current: Pick<CurrentOutputDocument, 'buildId' | 'packagePath' | 'ui'>
): Promise<void> {
  const documentPath = path.join(publicationPath, CURRENT_OUTPUT_FILE)
  const tempDocumentPath = path.join(
    publicationPath,
    `.${CURRENT_OUTPUT_FILE}.${process.pid}-${Date.now()}.tmp`
  )
  const document: CurrentOutputDocument = {
    schemaVersion: 1,
    extensionId: manifest.id,
    version: manifest.version,
    buildId: current.buildId,
    packagePath: toOutputRelativePath(publicationPath, current.packagePath),
    publishedAt: new Date().toISOString(),
    ...(current.ui === undefined ? {} : { ui: current.ui })
  }

  await writeFile(tempDocumentPath, `${JSON.stringify(document, null, 2)}\n`)
  try {
    await retryFileSystemOperation(() => rename(tempDocumentPath, documentPath))
  } catch (error) {
    await removePath(tempDocumentPath).catch(() => undefined)
    throw error
  }
}

async function cleanupPublishedVersions(
  publicationPath: string,
  currentBuildId: string
): Promise<void> {
  const versionsPath = path.join(publicationPath, OUTPUT_VERSIONS_DIR)
  if (!(await pathExists(versionsPath))) {
    return
  }

  const entries = await readdir(versionsPath, { withFileTypes: true })
  const staleBuildIds = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((buildId) => buildId !== currentBuildId)
    .sort()
    .reverse()
    .slice(Math.max(OUTPUT_VERSION_RETAIN_COUNT - 1, 0))

  await Promise.all(
    staleBuildIds.map((buildId) =>
      removePath(path.join(versionsPath, buildId)).catch(() => undefined)
    )
  )
}

function createOutputBuildId(): string {
  outputBuildSequence += 1
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '').replace('T', 't')
  return `${timestamp}-${process.pid}-${outputBuildSequence}`
}

function toOutputRelativePath(rootPath: string, targetPath: string): string {
  return path.relative(rootPath, targetPath).split(path.sep).join('/')
}

function resolveOutputRelativePath(rootPath: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    throw new CliError('Package output path must be relative.')
  }

  const segments = relativePath.split(/[\\/]+/).filter(Boolean)
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === '.' || segment === '..') ||
    segments[0] !== OUTPUT_VERSIONS_DIR
  ) {
    throw new CliError('Package output path must point inside versions/.')
  }

  return path.resolve(rootPath, ...segments)
}

async function removePath(targetPath: string): Promise<void> {
  await rm(targetPath, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100
  })
}

async function removeEmptyDirectory(targetPath: string): Promise<void> {
  await rmdir(targetPath)
}

async function retryFileSystemOperation(operation: () => Promise<void>): Promise<void> {
  const retryDelays = [50, 100, 250, 500, 1000]
  let lastError: unknown

  for (const delayMs of [0, ...retryDelays]) {
    if (delayMs > 0) {
      await delay(delayMs)
    }

    try {
      await operation()
      return
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function rewriteCopiedDistSourceMaps(
  sourceDistDir: string,
  targetDistDir: string
): Promise<void> {
  const entries = await readdir(targetDistDir, { withFileTypes: true })

  for (const entry of entries) {
    const targetPath = path.join(targetDistDir, entry.name)
    const sourcePath = path.join(sourceDistDir, entry.name)

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
