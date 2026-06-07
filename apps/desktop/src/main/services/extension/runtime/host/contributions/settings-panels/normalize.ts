import type {
  SettingsPanelDialogModel,
  SettingsPanelField,
  SettingsPanelFieldContentNode,
  SettingsPanelPopoverModel,
  SettingsPanelResolvedSurfacePayload,
  SettingsPanelRootModel,
  SettingsPanelTab
} from '@kisaki3/extension-api'
import { toJsonObject } from '../../sdk-bridge/utils/serialization'
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
    submitLabel: model.submitLabel ?? context.contribution.submitLabel
  })

  const tabs = (model as { tabs?: readonly SettingsPanelTab<any>[] }).tabs
  const payload = Array.isArray(tabs)
    ? compactRecord({
        ...base,
        activeTabId: model.activeTabId,
        tabs: tabs.map((tab) => normalizeSettingsPanelTab(tab, context))
      })
    : {
        ...base,
        fields: (model as { fields: readonly SettingsPanelField<any>[] }).fields.map((field) =>
          normalizeSettingsPanelField(field, context)
        )
      }

  return toSettingsPanelJsonObject(payload, 'resolved settings root')
}

export function normalizeSettingsPanelDialogModel(
  model: SettingsPanelDialogModel<any, any>,
  context: NormalizeSettingsPanelContext
): SettingsPanelResolvedSurfacePayload {
  return toSettingsPanelJsonObject(
    compactRecord({
      surface: 'dialog',
      dialogId: context.surface.dialogId,
      title: model.title ?? context.surfaceDefaults?.title,
      description: model.description,
      size: model.size ?? context.surfaceDefaults?.size,
      submitLabel: model.submitLabel ?? context.surfaceDefaults?.submitLabel,
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
  return toSettingsPanelJsonObject(
    compactRecord({
      surface: 'popover',
      popoverId: context.surface.popoverId,
      parent: context.surface.parent,
      anchorNodeKey: context.anchorNodeKey,
      title: model.title ?? context.surfaceDefaults?.title,
      description: model.description,
      width: model.width ?? context.surfaceDefaults?.width,
      fields: (model.fields as readonly SettingsPanelField<any>[]).map((field) =>
        normalizeSettingsPanelField(field, context)
      )
    }),
    'resolved settings popover'
  )
}

function toSettingsPanelJsonObject(
  value: unknown,
  label: string
): SettingsPanelResolvedSurfacePayload {
  return toJsonObject(value, label)
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
    help: field.help,
    link: field.link,
    hidden: field.hidden,
    disabled: field.disabled,
    orientation: field.orientation ?? 'horizontal',
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
    case 'radioGroup':
    case 'multiSelect':
    case 'textInput':
    case 'textarea':
    case 'numberInput':
    case 'stringList':
    case 'recordList': {
      const { onChange, ...item } = node
      const callbackId =
        typeof onChange === 'function'
          ? registerSettingsPanelCallback(fieldId, node.id, 'change', context, onChange, node.kind)
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
    case 'link':
    case 'notice':
    case 'status':
    case 'table':
    case 'comparisonList':
    case 'text':
      return compactRecord(node as unknown as Record<string, unknown>)
  }
}
