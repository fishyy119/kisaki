import { parentPort } from 'electron/utility'
import {
  EXTENSION_API_VERSION,
  EXTENSION_RPC_PROTOCOL_VERSION,
  type RuntimeInfo
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

const sdkBridge = new ExtensionHostSdkBridge(registry, rpc, createDefaultRuntimeInfo())
const loader = new ExtensionLoader(registry, sdkBridge)

sdkBridge.configure()

rpc.handleHandshake(async (request) => {
  if (request.protocolVersion !== EXTENSION_RPC_PROTOCOL_VERSION) {
    return {
      protocolVersion: EXTENSION_RPC_PROTOCOL_VERSION,
      accepted: false,
      error: {
        code: 'protocol_mismatch',
        message: `Expected protocol ${EXTENSION_RPC_PROTOCOL_VERSION}, received ${request.protocolVersion}.`
      }
    }
  }

  const runtimeInfo = parseRuntimeInfo(request.metadata)
  if (runtimeInfo) {
    sdkBridge.setRuntimeInfo(runtimeInfo)
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

rpc.handle('extensions.load', async ({ extension, generation }) => {
  await loader.loadExtension(extension, generation)
  return {}
})

rpc.handle('extensions.unload', async ({ extensionId }) => {
  return loader.unloadExtension(extensionId)
})

rpc.handle('extensions.reload', async ({ extension, generation }) => {
  await loader.reloadExtension(extension, generation)
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

function createDefaultRuntimeInfo(): RuntimeInfo {
  return {
    appVersion: '0.0.0',
    apiVersion: EXTENSION_API_VERSION,
    mode: 'production',
    platform: toRuntimePlatform(process.platform),
    arch: process.arch
  }
}

function parseRuntimeInfo(metadata: unknown): RuntimeInfo | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }

  const value = metadata as Partial<Record<keyof RuntimeInfo, unknown>>
  if (
    typeof value.appVersion !== 'string' ||
    typeof value.apiVersion !== 'string' ||
    typeof value.mode !== 'string' ||
    typeof value.platform !== 'string' ||
    typeof value.arch !== 'string'
  ) {
    return null
  }

  if (
    (value.mode !== 'development' && value.mode !== 'production') ||
    (value.platform !== 'windows' && value.platform !== 'macos' && value.platform !== 'linux')
  ) {
    return null
  }

  return {
    appVersion: value.appVersion,
    apiVersion: value.apiVersion,
    mode: value.mode,
    platform: value.platform,
    arch: value.arch
  }
}

function toRuntimePlatform(platform: NodeJS.Platform): RuntimeInfo['platform'] {
  switch (platform) {
    case 'darwin':
      return 'macos'
    case 'win32':
      return 'windows'
    default:
      return 'linux'
  }
}
