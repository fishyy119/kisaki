import type { SerializableValue } from '@kisaki/extension-api'
import type {
  ExtensionResolvedSettingsDialog,
  ExtensionResolvedSettingsField,
  ExtensionResolvedSettingsNode,
  ExtensionResolvedSettingsPopover,
  ExtensionResolvedSettingsRoot,
  ExtensionSettingsDraftSnapshot
} from '@shared/extension'

export function isSettingsValueNode(node: ExtensionResolvedSettingsNode): boolean {
  return (
    node.kind === 'switch' ||
    node.kind === 'checkbox' ||
    node.kind === 'select' ||
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
    | ExtensionResolvedSettingsRoot
    | ExtensionResolvedSettingsDialog
    | ExtensionResolvedSettingsPopover
): readonly ExtensionResolvedSettingsField[] {
  if (view.surface === 'root' && 'tabs' in view && view.tabs) {
    return view.tabs.flatMap((tab) => tab.fields)
  }

  return 'fields' in view ? view.fields : []
}

export function createDraftSnapshot(
  view:
    | ExtensionResolvedSettingsRoot
    | ExtensionResolvedSettingsDialog
    | ExtensionResolvedSettingsPopover
): ExtensionSettingsDraftSnapshot {
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
  next: ExtensionSettingsDraftSnapshot,
  previous: ExtensionSettingsDraftSnapshot
): ExtensionSettingsDraftSnapshot {
  const values: Record<string, SerializableValue> = { ...next.values }
  const dirtyNodeIds = previous.dirtyNodeIds.filter((nodeId) => nodeId in next.values)

  for (const nodeId of dirtyNodeIds) {
    values[nodeId] = previous.values[nodeId]
  }

  return { values, dirtyNodeIds }
}
