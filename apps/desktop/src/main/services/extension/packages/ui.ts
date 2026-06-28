import { pathToFileURL } from 'node:url'
import fse from 'fs-extra'
import { net } from 'electron'
import { createLogger } from '@main/log'
import { EXTENSION_UI_SCHEME } from '@main/bootstrap/protocol'
import { requireSafeExtensionId, resolveInsideRoot } from '../shared/path-confinement'
import { createProtocolHandlerSlot } from '../shared/protocol-slot'

const log = createLogger('Extension')

const DEVELOPMENT_PROXY_REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'cache-control',
  'if-modified-since',
  'if-none-match',
  'range'
] as const

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
 * Serves every webview document through the app-owned
 * `kisaki-extension-ui://<extension-id>/<path>` scheme. Package assets are
 * confined to the manifest `ui` root; development assets are proxied to the
 * extension's validated loopback Vite server. The renderer therefore keeps
 * one CSP-safe URL and origin model in every environment.
 */
export class ExtensionUiAssetServer {
  constructor(private readonly options: ExtensionUiAssetServerOptions) {}

  registerProtocolHandler(): void {
    extensionUiProtocolSlot.activate((request) => this.serveRequest(request))
  }

  documentUrl(extensionId: string, entry: string): string | null {
    const source = this.options.resolveUiSource(extensionId)
    if (!source) {
      return null
    }

    const safeExtensionId = requireSafeExtensionId(extensionId)
    const url = new URL(`${EXTENSION_UI_SCHEME}://${safeExtensionId}/`)
    url.pathname = `/${entry}`
    return url.toString()
  }

  private async serveRequest(request: Request): Promise<Response> {
    let extensionId: string | null = null

    try {
      const url = new URL(request.url)
      extensionId = requireSafeExtensionId(url.hostname)
      const source = this.options.resolveUiSource(extensionId)
      if (!source || !matchesUiProtocolOrigin(url)) {
        return new Response('Extension UI assets not available', { status: 404 })
      }

      if (source.kind === 'dev-server') {
        return await proxyDevelopmentAsset(request, url, source.origin)
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
      log.warn('Failed to serve extension UI asset.', error, { extensionId })
      return new Response('Failed to load extension UI asset', { status: 500 })
    }
  }
}

function matchesUiProtocolOrigin(url: URL): boolean {
  return !url.username && !url.password && url.port === ''
}

async function proxyDevelopmentAsset(
  request: Request,
  requestUrl: URL,
  origin: string
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Extension UI request method not allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' }
    })
  }

  const targetUrl = new URL(origin)
  targetUrl.pathname = requestUrl.pathname
  targetUrl.search = requestUrl.search

  return await net.fetch(targetUrl.toString(), {
    method: request.method,
    headers: pickDevelopmentProxyHeaders(request.headers)
  })
}

function pickDevelopmentProxyHeaders(source: Headers): Headers {
  const headers = new Headers()

  for (const name of DEVELOPMENT_PROXY_REQUEST_HEADERS) {
    const value = source.get(name)
    if (value !== null) {
      headers.set(name, value)
    }
  }

  return headers
}

export function resolveExtensionUiRootPath(packagePath: string, uiRoot: string): string {
  return resolveInsideRoot(packagePath, ...uiRoot.split('/').filter(Boolean))
}
