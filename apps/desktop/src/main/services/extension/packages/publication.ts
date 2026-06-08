import path from 'node:path'
import fse from 'fs-extra'
import { requireSafeExtensionId, resolveInsideRoot } from '../shared/path-confinement'

export const EXTENSION_PACKAGE_CURRENT_FILE = 'current.json'
export const EXTENSION_PACKAGE_VERSIONS_DIR = 'versions'

export interface ExtensionPackagePublication {
  publicationPath: string
  packagePath: string
  manifestPath: string
  pointerPath: string
  extensionId: string
  version: string
  buildId: string
  publishedAt: string
}

interface ExtensionPackagePublicationDocument {
  schemaVersion?: unknown
  extensionId?: unknown
  version?: unknown
  buildId?: unknown
  packagePath?: unknown
  publishedAt?: unknown
}

export async function readExtensionPackagePublication(
  publicationPath: string,
  expectedExtensionId?: string
): Promise<ExtensionPackagePublication | null> {
  const rootPath = path.resolve(publicationPath)
  const pointerPath = resolveInsideRoot(rootPath, EXTENSION_PACKAGE_CURRENT_FILE)
  if (!(await fse.pathExists(pointerPath))) {
    return null
  }

  const document = (await fse.readJson(pointerPath)) as ExtensionPackagePublicationDocument
  if (document.schemaVersion !== 1) {
    throw new Error('current.json schemaVersion must be 1.')
  }

  const extensionId = requirePointerExtensionId(document.extensionId, expectedExtensionId)
  const packagePath = resolvePointerPackagePath(rootPath, document.packagePath)

  return {
    publicationPath: rootPath,
    packagePath,
    manifestPath: resolveInsideRoot(packagePath, 'manifest.json'),
    pointerPath,
    extensionId,
    version: requirePointerString(document.version, 'version'),
    buildId: requirePointerString(document.buildId, 'buildId'),
    publishedAt: requirePointerString(document.publishedAt, 'publishedAt')
  }
}

function requirePointerExtensionId(
  value: unknown,
  expectedExtensionId: string | undefined
): string {
  const extensionId = requireSafeExtensionId(value, 'current.json extensionId')
  if (expectedExtensionId && extensionId !== expectedExtensionId) {
    throw new Error('current.json extensionId must match the extension output directory.')
  }

  return extensionId
}

function resolvePointerPackagePath(publicationPath: string, value: unknown): string {
  const relativePath = requirePointerString(value, 'packagePath')
  if (path.isAbsolute(relativePath)) {
    throw new Error('current.json packagePath must be relative.')
  }

  const segments = relativePath.split(/[\\/]+/).filter(Boolean)
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === '.' || segment === '..') ||
    segments[0] !== EXTENSION_PACKAGE_VERSIONS_DIR
  ) {
    throw new Error('current.json packagePath must point inside versions/.')
  }

  return resolveInsideRoot(publicationPath, ...segments)
}

function requirePointerString(value: unknown, label: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }

  throw new Error(`current.json ${label} must be a non-empty string.`)
}
