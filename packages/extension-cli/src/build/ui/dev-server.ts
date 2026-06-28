import { createServer as createHttpServer, type Server as HttpServer } from 'node:http'
import { createServer, mergeConfig, type InlineConfig, type ViteDevServer } from 'vite'
import type { KisxConfig } from '../../config'
import { CliError } from '../../errors'
import type { ExtensionProject } from '../../project'

const UI_DEV_SERVER_HOST = '127.0.0.1'
const AUTO_ASSIGNED_UI_DEV_SERVER_PORT = 0
const MAX_TCP_PORT = 65_535

/** A running webview UI development server. */
export interface ExtensionUiDevServer {
  origin: string
  close(): Promise<void>
}

/**
 * Starts the loopback server that delivers webview documents with Vite HMR.
 * @remarks The HTTP listener owns its selected port continuously; Vite shares
 * that listener for middleware and WebSocket transport.
 */
export async function startUiDevServer(
  project: ExtensionProject,
  config: KisxConfig
): Promise<ExtensionUiDevServer> {
  const base: InlineConfig = {
    configFile: false,
    root: project.uiSourceDir,
    appType: 'mpa',
    logLevel: 'warn',
    clearScreen: false
  }

  const merged = config.ui ? mergeConfig(base, config.ui) : base
  const requestedPort = resolveRequestedPort(merged.server?.port)
  const httpServer = createHttpServer()

  let port: number
  let viteServer: ViteDevServer
  try {
    port = await listenOnAvailablePort(
      httpServer,
      requestedPort,
      merged.server?.strictPort === true
    )
    viteServer = await createServer(createViteConfig(merged, httpServer, port))
    httpServer.on('request', viteServer.middlewares)
  } catch (error) {
    await Promise.allSettled([closeHttpServer(httpServer)])
    throw error
  }

  let closePromise: Promise<void> | undefined

  return {
    origin: `http://${UI_DEV_SERVER_HOST}:${port}`,
    close: () => {
      closePromise ??= closeUiDevServer(httpServer, viteServer)
      return closePromise
    }
  }
}

function createViteConfig(
  merged: InlineConfig,
  httpServer: HttpServer,
  port: number
): InlineConfig {
  const server = { ...merged.server }
  server.host = UI_DEV_SERVER_HOST
  server.port = port
  server.strictPort = true
  server.middlewareMode = { server: httpServer }
  delete server.https
  delete server.origin

  if (server.hmr !== false) {
    const hmr = typeof server.hmr === 'object' ? { ...server.hmr } : {}
    delete hmr.clientPort
    delete hmr.port
    delete hmr.server
    server.hmr = {
      ...hmr,
      clientPort: port,
      host: UI_DEV_SERVER_HOST,
      protocol: 'ws',
      server: httpServer
    }
  }

  return { ...merged, server }
}

function resolveRequestedPort(value: number | undefined): number {
  const port = value ?? AUTO_ASSIGNED_UI_DEV_SERVER_PORT
  if (!Number.isInteger(port) || port < 0 || port > MAX_TCP_PORT) {
    throw new CliError('UI development server port must be an integer between 0 and 65535.')
  }

  return port
}

function listenOnAvailablePort(
  server: HttpServer,
  requestedPort: number,
  strictPort: boolean
): Promise<number> {
  return new Promise((resolve, reject) => {
    let port = requestedPort

    const cleanup = (): void => {
      server.off('error', onError)
      server.off('listening', onListening)
    }

    const rejectWith = (error: CliError): void => {
      cleanup()
      reject(error)
    }

    const onError = (error: NodeJS.ErrnoException): void => {
      if (error.code !== 'EADDRINUSE') {
        rejectWith(new CliError('Failed to start the UI development server on loopback.'))
        return
      }

      if (strictPort) {
        rejectWith(new CliError(`UI development server port ${requestedPort} is already in use.`))
        return
      }

      if (port >= MAX_TCP_PORT) {
        rejectWith(
          new CliError('No available loopback port was found for the UI development server.')
        )
        return
      }

      port += 1
      listen()
    }

    const onListening = (): void => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        rejectWith(new CliError('UI development server did not expose a TCP listening address.'))
        return
      }

      cleanup()
      resolve(address.port)
    }

    const listen = (): void => {
      server.listen({ host: UI_DEV_SERVER_HOST, port, exclusive: true })
    }

    server.on('error', onError)
    server.on('listening', onListening)
    listen()
  })
}

async function closeUiDevServer(httpServer: HttpServer, viteServer: ViteDevServer): Promise<void> {
  httpServer.off('request', viteServer.middlewares)

  let failure: unknown
  try {
    await viteServer.close()
  } catch (error) {
    failure = error
  }

  try {
    await closeHttpServer(httpServer)
  } catch (error) {
    failure ??= error
  }

  if (failure) {
    throw failure
  }
}

function closeHttpServer(server: HttpServer): Promise<void> {
  if (!server.listening) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(new CliError('Failed to stop the UI development server.'))
        return
      }

      resolve()
    })
  })
}
