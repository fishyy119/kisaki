import type { SettingsPanelAnyNodeEvents, SettingsPanelNodeFactory } from '@kisaki/extension-api'

export function createSettingsPanelNodeFactory<
  TEvents extends SettingsPanelAnyNodeEvents
>(): SettingsPanelNodeFactory<TEvents> {
  return {
    switch: (node) => ({ ...node, kind: 'switch' }),
    checkbox: (node) => ({ ...node, kind: 'checkbox' }),
    select: (node) => ({ ...node, kind: 'select' }),
    multiSelect: (node) => ({ ...node, kind: 'multiSelect' }),
    textInput: (node) => ({ ...node, kind: 'textInput' }),
    textarea: (node) => ({ ...node, kind: 'textarea' }),
    numberInput: (node) => ({ ...node, kind: 'numberInput' }),
    stringList: (node) => ({ ...node, kind: 'stringList' }),
    recordList: (node) => ({ ...node, kind: 'recordList' }),
    button: (node) => ({ ...node, kind: 'button' }),
    text: (node) => ({ ...node, kind: 'text' }),
    notice: (node) => ({ ...node, kind: 'notice' }),
    status: (node) => ({ ...node, kind: 'status' }),
    table: (node) => ({ ...node, kind: 'table' }),
    link: (node) => ({ ...node, kind: 'link' }),
    image: (node) => ({ ...node, kind: 'image' }),
    divider: (node) => ({ ...node, kind: 'divider' })
  }
}
