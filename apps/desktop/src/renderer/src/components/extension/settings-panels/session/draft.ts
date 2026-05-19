import type { SerializableValue } from '@kisaki/extension-api'
import type {
  ExtensionResolvedSettingsPanelDialog,
  ExtensionResolvedSettingsPanelField,
  ExtensionResolvedSettingsPanelNode,
  ExtensionResolvedSettingsPanelPopover,
  ExtensionResolvedSettingsPanelRoot,
  ExtensionSettingsPanelDraftSnapshot
} from '@shared/extension'

export function isSettingsValueNode(node: ExtensionResolvedSettingsPanelNode): boolean {
  return (
    node.kind === 'switch' ||
    node.kind === 'checkbox' ||
    node.kind === 'select' ||
    node.kind === 'radioGroup' ||
    node.kind === 'multiSelect' ||
    node.kind === 'textInput' ||
    node.kind === 'textarea' ||
    node.kind === 'numberInput' ||
    node.kind === 'stringList' ||
    node.kind === 'recordList'
  )
}

export function getSettingsFields(
  view:
    | ExtensionResolvedSettingsPanelRoot
    | ExtensionResolvedSettingsPanelDialog
    | ExtensionResolvedSettingsPanelPopover
): readonly ExtensionResolvedSettingsPanelField[] {
  if (view.surface === 'root' && 'tabs' in view && view.tabs) {
    return view.tabs.flatMap((tab) => tab.fields)
  }

  return 'fields' in view ? view.fields : []
}

export function createDraftSnapshot(
  view:
    | ExtensionResolvedSettingsPanelRoot
    | ExtensionResolvedSettingsPanelDialog
    | ExtensionResolvedSettingsPanelPopover
): ExtensionSettingsPanelDraftSnapshot {
  const values: Record<string, SerializableValue> = {}
  for (const field of getSettingsFields(view)) {
    for (const node of field.content) {
      if (isSettingsValueNode(node) && 'initialValue' in node) {
        values[node.id] = node.initialValue
      }
    }
  }

  return {
    values,
    dirtyNodeIds: []
  }
}

export function mergeDraftSnapshot(
  next: ExtensionSettingsPanelDraftSnapshot,
  previous: ExtensionSettingsPanelDraftSnapshot
): ExtensionSettingsPanelDraftSnapshot {
  const values: Record<string, SerializableValue> = { ...next.values }
  const dirtyNodeIds = previous.dirtyNodeIds.filter((nodeId) => nodeId in next.values)

  for (const nodeId of dirtyNodeIds) {
    values[nodeId] = previous.values[nodeId]
  }

  return { values, dirtyNodeIds }
}
