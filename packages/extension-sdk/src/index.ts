import type { ExtensionDefinition, KisakiApi } from '@kisaki/extension-api'
import { getExtensionSdkBridge } from './bridge'

export * from '@kisaki/extension-api'

export function defineExtension(definition: ExtensionDefinition): ExtensionDefinition {
  return definition
}

export const kisaki: KisakiApi = {
  get library() {
    return getExtensionSdkBridge().api.library
  },
  get network() {
    return getExtensionSdkBridge().api.network
  },
  get notify() {
    return getExtensionSdkBridge().api.notify
  },
  get events() {
    return getExtensionSdkBridge().api.events
  },
  get runtime() {
    return getExtensionSdkBridge().api.runtime
  }
}

export { createDisposableStore } from './bridge'
