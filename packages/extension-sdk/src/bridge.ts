import type { KisakiApi } from '@kisaki3/extension-api'

interface ExtensionSdkBridge {
  readonly api: KisakiApi
}

interface ExtensionSdkBridgeStore {
  bridge: ExtensionSdkBridge | null
}

const EXTENSION_SDK_BRIDGE_KEY = Symbol.for('kisaki.extensionSdkBridge')

function getBridgeStore(): ExtensionSdkBridgeStore {
  const globalObject = globalThis as typeof globalThis &
    Record<symbol, ExtensionSdkBridgeStore | undefined>
  let store = globalObject[EXTENSION_SDK_BRIDGE_KEY]

  if (!store) {
    store = { bridge: null }
    globalObject[EXTENSION_SDK_BRIDGE_KEY] = store
  }

  return store
}

export function getExtensionSdkBridge(): ExtensionSdkBridge {
  const bridge = getBridgeStore().bridge

  if (!bridge) {
    throw new Error(
      'The Kisaki extension SDK bridge has not been configured. The extension host must install the runtime bridge before loading extensions.'
    )
  }

  return bridge
}
