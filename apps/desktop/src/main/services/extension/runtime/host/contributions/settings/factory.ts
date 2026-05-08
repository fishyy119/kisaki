import { randomUUID } from 'node:crypto'
import type { SettingsAnyNodeEvents, SettingsNodeFactory } from '@kisaki/extension-api'

export function createSettingsNodeFactory<
  TEvents extends SettingsAnyNodeEvents
>(): SettingsNodeFactory<TEvents> {
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
    image: (node) => ({ ...node, kind: 'image' }),
    divider: (node = { id: randomUUID() }) => ({ ...node, kind: 'divider' })
  }
}
