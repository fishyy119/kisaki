import type { KisakiApi } from '@kisaki3/extension-api'
import type { ExtensionSdkBridgeStore } from './types'

const EXTENSION_SDK_BRIDGE_KEY = Symbol.for('kisaki.extensionSdkBridge')

/**
 * Installs the process-wide SDK bridge consumed by the extension SDK package.
 */
export function configureExtensionSdkBridge(bridge: { readonly api: KisakiApi }): void {
  const store = getBridgeStore()

  if (store.bridge && store.bridge !== bridge) {
    throw new Error(
      'The Kisaki extension SDK bridge has already been configured for this process. Reset it before replacing the bridge instance.'
    )
  }

  store.bridge = bridge
}

/**
 * Clears the process-wide SDK bridge during host shutdown.
 */
export function resetExtensionSdkBridge(): void {
  getBridgeStore().bridge = null
}

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
