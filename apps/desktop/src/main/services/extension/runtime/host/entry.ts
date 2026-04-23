import { parentPort } from 'electron/utility'
import {
  EXTENSION_RPC_PROTOCOL_VERSION,
  createExtensionError,
  toRpcErrorPayload
} from '@kisaki/extension-api'
import { ExtensionLoader } from './extension-loader'
import { ExtensionRegistry } from './extension-registry'
import { ExtensionHostRpcServer } from './rpc-server'
import { ExtensionHostSdkBridge } from './sdk-bridge'

if (!parentPort) {
  throw new Error('Kisaki extension host requires electron/utility parentPort')
}

const registry = new ExtensionRegistry()
const rpc = new ExtensionHostRpcServer((message) => {
  parentPort.postMessage(message)
})

const sdkBridge = new ExtensionHostSdkBridge(registry, rpc)
const loader = new ExtensionLoader(registry, sdkBridge)

sdkBridge.configure()

rpc.handleHandshake(async (request) => {
  if (request.protocolVersion !== EXTENSION_RPC_PROTOCOL_VERSION) {
    return {
      protocolVersion: EXTENSION_RPC_PROTOCOL_VERSION,
      accepted: false,
      error: toRpcErrorPayload(
        createExtensionError(
          `Expected protocol ${EXTENSION_RPC_PROTOCOL_VERSION}, received ${request.protocolVersion}.`,
          {
            code: 'protocol_mismatch'
          }
        )
      )
    }
  }

  return {
    protocolVersion: EXTENSION_RPC_PROTOCOL_VERSION,
    accepted: true,
    metadata: {
      pid: process.pid,
      loadedExtensions: registry.list().length
    }
  }
})

rpc.handle('extensions.load', async ({ extension, runtimeHandle, generation }) => {
  await loader.loadExtension(extension, runtimeHandle, generation)
  return {}
})

rpc.handle('extensions.unload', async ({ extensionId, runtimeHandle }) => {
  return loader.unloadExtension(extensionId, runtimeHandle)
})

rpc.handle('extensions.reload', async ({ extension, runtimeHandle, generation }) => {
  await loader.reloadExtension(extension, runtimeHandle, generation)
  return {}
})

parentPort.on('message', (event) => {
  void rpc.onMessage(event.data).catch((error) => {
    console.error('[ExtensionHost] Failed to process RPC message:', error)
  })
})

process.on('uncaughtException', (error) => {
  console.error('[ExtensionHost] Uncaught exception:', error)
  void shutdownHost().finally(() => process.exit(1))
})

process.on('unhandledRejection', (error) => {
  console.error('[ExtensionHost] Unhandled rejection:', error)
  void shutdownHost().finally(() => process.exit(1))
})

process.on('SIGTERM', () => {
  void shutdownHost().finally(() => process.exit(0))
})

process.on('SIGINT', () => {
  void shutdownHost().finally(() => process.exit(0))
})

let shutdownPromise: Promise<void> | null = null

async function shutdownHost(): Promise<void> {
  if (shutdownPromise) {
    return shutdownPromise
  }

  shutdownPromise = (async () => {
    try {
      await loader.shutdown()
    } finally {
      sdkBridge.dispose()
      rpc.dispose('Extension host shutting down')
    }
  })()

  await shutdownPromise
}
