import type { SerializableValue, SettingsResolvedNode } from '@kisaki/extension-api'
import {
  getExtensionSettingsContributions,
  invokeExtensionSettingsNode,
  openExtensionSettingsFrame,
  openExtensionSettingsSession,
  refreshExtensionSettingsFrame,
  releaseExtensionSettingsFrame,
  releaseExtensionSettingsSession,
  submitExtensionSettingsFrame
} from './ipc'

export type SettingsDraft = Record<string, SerializableValue>

export {
  getExtensionSettingsContributions,
  invokeExtensionSettingsNode,
  openExtensionSettingsFrame,
  openExtensionSettingsSession,
  refreshExtensionSettingsFrame,
  releaseExtensionSettingsFrame,
  releaseExtensionSettingsSession,
  submitExtensionSettingsFrame
}

export function createSettingsDraft(nodes: readonly SettingsResolvedNode[]): SettingsDraft {
  const draft: SettingsDraft = {}

  for (const node of nodes) {
    collectSettingsNodeValue(draft, node)
  }

  return draft
}

export function getSettingsNodeCallbackId(node: SettingsResolvedNode): string | undefined {
  return 'callbackId' in node ? node.callbackId : undefined
}

function collectSettingsNodeValue(draft: SettingsDraft, node: SettingsResolvedNode): void {
  switch (node.kind) {
    case 'section':
      for (const child of node.children) {
        collectSettingsNodeValue(draft, child)
      }
      break

    case 'switch':
    case 'checkbox':
      draft[node.id] = node.value
      break

    case 'select':
    case 'textInput':
    case 'textarea':
      draft[node.id] = node.value ?? ''
      break

    case 'numberInput':
      draft[node.id] = node.value ?? null
      break

    case 'button':
    case 'dialog':
    case 'divider':
    case 'notice':
    case 'status':
    case 'text':
      break
  }
}
