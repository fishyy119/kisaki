import { pathToFileURL } from 'node:url'
import fse from 'fs-extra'
import { net } from 'electron'
import { createLogger } from '@main/log'
import { EXTENSION_UI_SCHEME } from '@main/bootstrap/protocol'
import { requireSafeExtensionId, resolveInsideRoot } from '../shared/path-confinement'
import { createProtocolHandlerSlot } from '../shared/protocol-slot'

const log = createLogger('Extension')

const extensionUiProtocolSlot = createProtocolHandlerSlot(
  EXTENSION_UI_SCHEME,
  'Extension UI service unavailable'
)

/**
 * Delivery source for an extension's webview UI assets.
 */
export type ExtensionWebviewUiSource =
  | { kind: 'package'; rootPath: string }
  | { kind: 'dev-server'; origin: string }

export interface ExtensionUiAssetServerOptions {
  resolveUiSource(extensionId: string): ExtensionWebviewUiSource | null
}

/**
 * Serves bundled webview UI assets from installed extension packages over the
 * `kisaki-extension-ui://<extension-id>/<path>` scheme. Each extension gets
 * its own origin; paths are confined to the manifest `ui` root.
 */
export class ExtensionUiAssetServer {
  constructor(private readonly options: ExtensionUiAssetServerOptions) {}

  registerProtocolHandler(): void {
    extensionUiProtocolSlot.activate((request) => this.serveRequest(request))
  }

  documentUrl(extensionId: string, entry: string): string {
    return `${EXTENSION_UI_SCHEME}://${extensionId}/${entry}`
  }

  private async serveRequest(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url)
      const extensionId = requireSafeExtensionId(url.hostname)
      const source = this.options.resolveUiSource(extensionId)
      if (!source || source.kind !== 'package') {
        return new Response('Extension UI assets not available', { status: 404 })
      }

      const segments = decodeURIComponent(url.pathname).split('/').filter(Boolean)
      if (segments.length === 0) {
        return new Response('Extension UI asset path required', { status: 400 })
      }

      const filePath = resolveInsideRoot(source.rootPath, ...segments)
      if (!(await fse.pathExists(filePath))) {
        return new Response('Extension UI asset not found', { status: 404 })
      }

      return await net.fetch(pathToFileURL(filePath).toString())
    } catch (error) {
      log.warn('Failed to serve extension UI asset:', error, { url: request.url })
      return new Response('Failed to load extension UI asset', { status: 500 })
    }
  }
}

export function resolveExtensionUiRootPath(packagePath: string, uiRoot: string): string {
  return resolveInsideRoot(packagePath, ...uiRoot.split('/').filter(Boolean))
}
