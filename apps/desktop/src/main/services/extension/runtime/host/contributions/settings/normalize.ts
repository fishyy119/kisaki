import type {
  SettingsDialogModel,
  SettingsField,
  SettingsFieldContentNode,
  SettingsPopoverModel,
  SettingsResolvedSurfacePayload,
  SettingsRootModel,
  SettingsTab
} from '@kisaki/extension-api'
import { toSerializableRecord } from '../../sdk-bridge/utils/serialization'
import { registerSettingsCallback } from './callbacks'
import type { NormalizeSettingsContext } from './types'
import { compactRecord } from './values'
export function normalizeRootModel(
  model: SettingsRootModel<any, any>,
  context: NormalizeSettingsContext
): SettingsResolvedSurfacePayload {
  const base = compactRecord({
    surface: 'root',
    title: model.title,
    description: model.description,
    size: model.size
  })

  const tabs = (model as { tabs?: readonly SettingsTab<any>[] }).tabs
  const payload = Array.isArray(tabs)
    ? {
        ...base,
        activeTabId: model.activeTabId,
        tabs: tabs.map((tab) => normalizeSettingsTab(tab, context))
      }
    : {
        ...base,
        fields: (model as { fields: readonly SettingsField<any>[] }).fields.map((field) =>
          normalizeSettingsField(field, context)
        )
      }

  return toSerializableRecord(payload, 'resolved settings root')
}

export function normalizeDialogModel(
  model: SettingsDialogModel<any, any>,
  context: NormalizeSettingsContext
): SettingsResolvedSurfacePayload {
  return toSerializableRecord(
    compactRecord({
      surface: 'dialog',
      dialogId: context.surface.dialogId,
      title: model.title,
      description: model.description,
      size: model.size,
      fields: (model.fields as readonly SettingsField<any>[]).map((field) =>
        normalizeSettingsField(field, context)
      )
    }),
    'resolved settings dialog'
  )
}

export function normalizePopoverModel(
  model: SettingsPopoverModel<any>,
  context: NormalizeSettingsContext
): SettingsResolvedSurfacePayload {
  return toSerializableRecord(
    compactRecord({
      surface: 'popover',
      popoverId: context.surface.popoverId,
      parent: context.surface.parent,
      anchorNodeKey: context.anchorNodeKey,
      title: model.title,
      description: model.description,
      width: model.width,
      fields: (model.fields as readonly SettingsField<any>[]).map((field) =>
        normalizeSettingsField(field, context)
      )
    }),
    'resolved settings popover'
  )
}

function normalizeSettingsTab(
  tab: SettingsTab<any>,
  context: NormalizeSettingsContext
): Record<string, unknown> {
  return compactRecord({
    id: tab.id,
    label: tab.label,
    description: tab.description,
    icon: tab.icon,
    fields: tab.fields.map((field) => normalizeSettingsField(field, context))
  })
}

function normalizeSettingsField(
  field: SettingsField<any>,
  context: NormalizeSettingsContext
): Record<string, unknown> {
  return compactRecord({
    id: field.id,
    label: field.label,
    description: field.description,
    hidden: field.hidden,
    disabled: field.disabled,
    orientation: field.orientation,
    span: field.span,
    contentLayout: field.contentLayout,
    contentColumns: field.contentColumns,
    content: field.content.map((node) => normalizeSettingsNode(field.id, node, context))
  })
}

function normalizeSettingsNode(
  fieldId: string,
  node: SettingsFieldContentNode<any>,
  context: NormalizeSettingsContext
): Record<string, unknown> {
  switch (node.kind) {
    case 'switch':
    case 'checkbox':
    case 'select':
    case 'multiSelect':
    case 'textInput':
    case 'textarea':
    case 'numberInput':
    case 'stringList':
    case 'recordList': {
      const { onCommit, ...item } = node
      const callbackId =
        typeof onCommit === 'function'
          ? registerSettingsCallback(fieldId, node.id, 'commit', context, onCommit, node.kind)
          : undefined
      return compactRecord({ ...item, callbackId })
    }

    case 'button': {
      const { onClick, ...item } = node
      const callbackId =
        typeof onClick === 'function'
          ? registerSettingsCallback(fieldId, node.id, 'button', context, onClick)
          : undefined
      return compactRecord({ ...item, callbackId })
    }

    case 'divider':
    case 'image':
    case 'notice':
    case 'status':
    case 'table':
    case 'text':
      return compactRecord(node as unknown as Record<string, unknown>)
  }
}
