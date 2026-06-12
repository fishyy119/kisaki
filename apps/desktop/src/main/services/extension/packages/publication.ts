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
  /**
   * Origin of the Vite dev server delivering webview UI assets, when the
   * publication declares `ui.mode === 'dev-server'`. Bundled UI assets
   * otherwise serve from the package directory.
   */
  uiDevServerOrigin: string | null
}

interface ExtensionPackagePublicationDocument {
  schemaVersion?: unknown
  extensionId?: unknown
  version?: unknown
  buildId?: unknown
  packagePath?: unknown
  publishedAt?: unknown
  ui?: unknown
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
    publishedAt: requirePointerString(document.publishedAt, 'publishedAt'),
    uiDevServerOrigin: resolvePointerUiDevServerOrigin(document.ui)
  }
}

function resolvePointerUiDevServerOrigin(value: unknown): string | null {
  if (value === undefined) {
    return null
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('current.json ui must be an object.')
  }

  const ui = value as { mode?: unknown; origin?: unknown }
  if (ui.mode === 'bundled') {
    return null
  }

  if (ui.mode !== 'dev-server') {
    throw new Error('current.json ui.mode must be "bundled" or "dev-server".')
  }

  const origin = requirePointerString(ui.origin, 'ui.origin')
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    throw new Error('current.json ui.origin must be a valid URL.')
  }

  if (parsed.protocol !== 'http:' || !isLoopbackHostname(parsed.hostname)) {
    throw new Error('current.json ui.origin must be a loopback http origin.')
  }

  return parsed.origin
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
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
