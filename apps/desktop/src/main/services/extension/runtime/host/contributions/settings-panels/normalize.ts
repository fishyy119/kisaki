import type {
  SettingsPanelDialogModel,
  SettingsPanelField,
  SettingsPanelFieldContentNode,
  SettingsPanelPopoverModel,
  SettingsPanelResolvedSurfacePayload,
  SettingsPanelRootModel,
  SettingsPanelTab
} from '@kisaki/extension-api'
import { toSerializableRecord } from '../../sdk-bridge/utils/serialization'
import { registerSettingsPanelCallback } from './callbacks'
import type { NormalizeSettingsPanelContext } from './types'
import { compactRecord } from './values'
export function normalizeSettingsPanelRootModel(
  model: SettingsPanelRootModel<any, any>,
  context: NormalizeSettingsPanelContext
): SettingsPanelResolvedSurfacePayload {
  const base = compactRecord({
    surface: 'root',
    title: model.title,
    description: model.description,
    size: model.size
  })

  const tabs = (model as { tabs?: readonly SettingsPanelTab<any>[] }).tabs
  const payload = Array.isArray(tabs)
    ? {
        ...base,
        activeTabId: model.activeTabId,
        tabs: tabs.map((tab) => normalizeSettingsPanelTab(tab, context))
      }
    : {
        ...base,
        fields: (model as { fields: readonly SettingsPanelField<any>[] }).fields.map((field) =>
          normalizeSettingsPanelField(field, context)
        )
      }

  return toSerializableRecord(payload, 'resolved settings root')
}

export function normalizeSettingsPanelDialogModel(
  model: SettingsPanelDialogModel<any, any>,
  context: NormalizeSettingsPanelContext
): SettingsPanelResolvedSurfacePayload {
  return toSerializableRecord(
    compactRecord({
      surface: 'dialog',
      dialogId: context.surface.dialogId,
      title: model.title,
      description: model.description,
      size: model.size,
      fields: (model.fields as readonly SettingsPanelField<any>[]).map((field) =>
        normalizeSettingsPanelField(field, context)
      )
    }),
    'resolved settings dialog'
  )
}

export function normalizeSettingsPanelPopoverModel(
  model: SettingsPanelPopoverModel<any>,
  context: NormalizeSettingsPanelContext
): SettingsPanelResolvedSurfacePayload {
  return toSerializableRecord(
    compactRecord({
      surface: 'popover',
      popoverId: context.surface.popoverId,
      parent: context.surface.parent,
      anchorNodeKey: context.anchorNodeKey,
      title: model.title,
      description: model.description,
      width: model.width,
      fields: (model.fields as readonly SettingsPanelField<any>[]).map((field) =>
        normalizeSettingsPanelField(field, context)
      )
    }),
    'resolved settings popover'
  )
}

function normalizeSettingsPanelTab(
  tab: SettingsPanelTab<any>,
  context: NormalizeSettingsPanelContext
): Record<string, unknown> {
  return compactRecord({
    id: tab.id,
    label: tab.label,
    description: tab.description,
    icon: tab.icon,
    fields: tab.fields.map((field) => normalizeSettingsPanelField(field, context))
  })
}

function normalizeSettingsPanelField(
  field: SettingsPanelField<any>,
  context: NormalizeSettingsPanelContext
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
  node: SettingsPanelFieldContentNode<any>,
  context: NormalizeSettingsPanelContext
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
          ? registerSettingsPanelCallback(fieldId, node.id, 'commit', context, onCommit, node.kind)
          : undefined
      return compactRecord({ ...item, callbackId })
    }

    case 'button': {
      const { onClick, ...item } = node
      const callbackId =
        typeof onClick === 'function'
          ? registerSettingsPanelCallback(fieldId, node.id, 'button', context, onClick)
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
