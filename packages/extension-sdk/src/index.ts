import type { ExtensionDefinition, KisakiApi } from '@kisaki3/extension-api'
import { getExtensionSdkBridge } from './bridge'

export * from '@kisaki3/extension-api'

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
  },
  get scrapers() {
    return getExtensionSdkBridge().api.scrapers
  },
  get ingest() {
    return getExtensionSdkBridge().api.ingest
  },
  get commands() {
    return getExtensionSdkBridge().api.commands
  },
  get automations() {
    return getExtensionSdkBridge().api.automations
  },
  get taskRuns() {
    return getExtensionSdkBridge().api.taskRuns
  }
}
