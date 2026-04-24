import type {
  SerializableValue,
  SettingsPanelResolvedControlNode,
  SettingsPanelResolvedNode
} from '@kisaki/extension-api'
import {
  getExtensionSettingsPanels,
  invokeExtensionSettingsPanel,
  resolveExtensionSettingsPanel,
  submitExtensionSettingsPanel
} from './ipc'

export type SettingsPanelDraft = Record<string, SerializableValue>

export {
  getExtensionSettingsPanels,
  invokeExtensionSettingsPanel,
  resolveExtensionSettingsPanel,
  submitExtensionSettingsPanel
}

export function createSettingsPanelDraft(
  nodes: readonly SettingsPanelResolvedNode[]
): SettingsPanelDraft {
  const draft: SettingsPanelDraft = {}

  for (const node of nodes) {
    if (node.kind !== 'section') {
      collectSettingsControlValue(draft, node)
      continue
    }

    for (const control of node.controls) {
      collectSettingsControlValue(draft, control)
    }
  }

  return draft
}

export function getSettingsControlCallbackId(
  node: SettingsPanelResolvedControlNode
): string | undefined {
  return 'callbackId' in node ? node.callbackId : undefined
}

function collectSettingsControlValue(
  draft: SettingsPanelDraft,
  node: SettingsPanelResolvedControlNode | SettingsPanelResolvedNode
): void {
  switch (node.kind) {
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
    case 'divider':
    case 'notice':
    case 'section':
    case 'status':
    case 'text':
      break
  }
}
