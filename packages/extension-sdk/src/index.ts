import type { ExtensionDefinition, KisakiApi } from '@kisaki/extension-api'
import { getEventsCapability } from './capabilities/events'
import { getLibraryCapability } from './capabilities/library'
import { getNetworkCapability } from './capabilities/network'
import { getNotifyCapability } from './capabilities/notify'
import { getRuntimeCapability } from './capabilities/runtime'

export * from '@kisaki/extension-api'

export function defineExtension(definition: ExtensionDefinition): ExtensionDefinition {
  return definition
}

export const kisaki: KisakiApi = {
  get library() {
    return getLibraryCapability()
  },
  get network() {
    return getNetworkCapability()
  },
  get notify() {
    return getNotifyCapability()
  },
  get events() {
    return getEventsCapability()
  },
  get runtime() {
    return getRuntimeCapability()
  }
}

export { createDisposableStore } from './bridge'
