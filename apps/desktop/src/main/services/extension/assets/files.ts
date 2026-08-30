import { pathToFileURL } from 'node:url'
import { net } from 'electron'
import { createLogger } from '@main/log'
import { EXTENSION_FILE_SCHEME } from '@main/bootstrap/protocol'
import { pathExists } from '@main/utils/fs'
import { requireSafeExtensionId, resolveInsideRoot } from '@shared/extension/path-confinement'
import { createProtocolHandlerSlot } from '@main/utils/protocol-slot'

const log = createLogger('Extension')

const extensionFileProtocolSlot = createProtocolHandlerSlot(
  EXTENSION_FILE_SCHEME,
  'Extension file service unavailable'
)

export interface ExtensionFileAssetServerOptions {
  /** Maps an extension id to its current package root, when installed. */
  resolvePackageRoot(extensionId: string): string | null
}

/**
 * Serves files out of installed extension packages through the app-owned
 * `kisaki-extension-file://<extension-id>/<path>` scheme: package icons and
 * contribution file icons. Paths are confined to the package root at serve
 * time, so a stale URL can never escape the extension's directory.
 */
export class ExtensionFileAssetServer {
  constructor(private readonly options: ExtensionFileAssetServerOptions) {}

  registerProtocolHandler(): void {
    extensionFileProtocolSlot.activate((request) => this.serveRequest(request))
  }

  private async serveRequest(request: Request): Promise<Response> {
    let extensionId: string | null = null

    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Extension file request method not allowed', {
          status: 405,
          headers: { Allow: 'GET, HEAD' }
        })
      }

      const url = new URL(request.url)
      extensionId = requireSafeExtensionId(url.hostname)
      const packageRoot = this.options.resolvePackageRoot(extensionId)
      if (!packageRoot) {
        return new Response('Extension files not available', { status: 404 })
      }

      const segments = decodeURIComponent(url.pathname).split('/').filter(Boolean)
      if (segments.length === 0) {
        return new Response('Extension file path required', { status: 400 })
      }

      const filePath = resolveInsideRoot(packageRoot, ...segments)
      if (!(await pathExists(filePath))) {
        return new Response('Extension file not found', { status: 404 })
      }

      return await net.fetch(pathToFileURL(filePath).toString())
    } catch (error) {
      log.warn('Failed to serve extension file.', error, { extensionId })
      return new Response('Failed to load extension file', { status: 500 })
    }
  }
}

/** Builds the served URL for a file inside an extension package. */
export function extensionFileUrl(extensionId: string, relativePath: string): string {
  const safeExtensionId = requireSafeExtensionId(extensionId)
  const url = new URL(`${EXTENSION_FILE_SCHEME}://${safeExtensionId}/`)
  url.pathname = `/${relativePath.split('/').filter(Boolean).join('/')}`
  return url.toString()
}
