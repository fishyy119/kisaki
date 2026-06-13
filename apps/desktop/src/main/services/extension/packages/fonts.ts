import path from 'node:path'
import fse from 'fs-extra'
import { app } from 'electron'
import { createLogger } from '@main/log'
import { EXTENSION_WEBVIEW_FONT_PACKAGES, EXTENSION_WEBVIEW_FONT_SCHEME } from '@shared/extension'
import { resolveInsideRoot } from '../shared/path-confinement'
import { createProtocolHandlerSlot } from '../shared/protocol-slot'

const log = createLogger('Extension')

const FONT_CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2'
}

// Webview document origins differ from the app; stylesheet and @font-face
// loads are CORS-gated, so the responses must opt in explicitly.
const FONT_RESPONSE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=86400'
} as const

const webviewFontProtocolSlot = createProtocolHandlerSlot(
  EXTENSION_WEBVIEW_FONT_SCHEME,
  'Webview font service unavailable'
)

/**
 * Serves the app font packages (sliced stylesheets plus woff2 files) to
 * extension webview documents over
 * `kisaki-webview-font://fonts/<dir>/<path>`. Paths are confined to the
 * package roots from the shared catalog; only stylesheet and font files are
 * served.
 */
export class ExtensionWebviewFontServer {
  private readonly rootsByDir: ReadonlyMap<string, string>

  constructor() {
    // The renderer build copies the packages to renderer-output fonts/<dir>;
    // the dev-server renderer serves them from middleware only, so dev mode
    // reads the npm packages directly.
    const devMode = Boolean(process.env['ELECTRON_RENDERER_URL'])
    this.rootsByDir = new Map(
      EXTENSION_WEBVIEW_FONT_PACKAGES.map((pkg) => [
        pkg.dir,
        devMode
          ? path.join(app.getAppPath(), 'node_modules', ...pkg.npmPackage.split('/'))
          : path.join(__dirname, '..', 'renderer', 'fonts', pkg.dir)
      ])
    )
  }

  registerProtocolHandler(): void {
    webviewFontProtocolSlot.activate((request) => this.serveRequest(request))
  }

  private async serveRequest(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url)
      const [dir, ...rest] = decodeURIComponent(url.pathname).split('/').filter(Boolean)
      const root = dir ? this.rootsByDir.get(dir) : undefined
      const fileName = rest.at(-1)
      if (!root || !fileName) {
        return new Response('Unknown webview font path', { status: 404 })
      }

      const contentType = FONT_CONTENT_TYPES[path.extname(fileName).toLowerCase()]
      if (!contentType) {
        return new Response('Unsupported webview font asset', { status: 404 })
      }

      const filePath = resolveInsideRoot(root, ...rest)
      if (!(await fse.pathExists(filePath))) {
        return new Response('Webview font asset not found', { status: 404 })
      }

      const data = await fse.readFile(filePath)
      return new Response(new Uint8Array(data), {
        headers: { ...FONT_RESPONSE_HEADERS, 'Content-Type': contentType }
      })
    } catch (error) {
      log.warn('Failed to serve webview font asset:', error, { url: request.url })
      return new Response('Failed to load webview font asset', { status: 500 })
    }
  }
}
