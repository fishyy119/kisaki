import type { Disposable, ExtensionErrorShape, SerializableValue } from '../../shared'

export type SettingsNoticeTone = 'info' | 'warning' | 'error' | 'success'

export type SettingsStatusTone = 'neutral' | 'success' | 'warning' | 'danger'

export type SettingsTextTone = 'default' | 'muted' | 'danger'

export type SettingsButtonTone = 'default' | 'primary' | 'danger'

export type SettingsDialogSize = 'sm' | 'md' | 'lg' | 'xl'

export type SettingsRefreshScope = 'current' | 'parent' | 'stack'

export type SettingsCloseScope = 'current' | 'all'

export interface SettingsDialogTarget {
  screenId: string
  params?: Record<string, SerializableValue>
}

export type SettingsCommand =
  | {
      type: 'refresh'
      scope: SettingsRefreshScope
    }
  | {
      type: 'close'
      scope: SettingsCloseScope
    }
  | {
      type: 'open'
      target: SettingsDialogTarget
    }

export type SettingsInteractionResult =
  | {
      success: true
      message?: string
      commands?: readonly SettingsCommand[]
    }
  | {
      success: false
      error: ExtensionErrorShape
      commands?: readonly SettingsCommand[]
    }

export interface SettingsNodeBase {
  id: string
  hidden?: boolean
}

export interface SettingsControlBase extends SettingsNodeBase {
  label?: string
  description?: string
  disabled?: boolean
}

export interface SettingsFrameContext {
  contributionId: string
  screenId: string
  frameId: string
  params: Record<string, SerializableValue>
  signal: AbortSignal
}

export interface SettingsCallbackContext extends SettingsFrameContext {
  nodeId: string
}

export interface SettingsSubmitEvent extends SettingsFrameContext {
  values: Record<string, SerializableValue>
}

export interface SettingsTextNode extends SettingsNodeBase {
  kind: 'text'
  text: string
  tone?: SettingsTextTone
}

export interface SettingsSwitchNode extends SettingsControlBase {
  kind: 'switch'
  value: boolean
  onChange?: (
    value: boolean,
    context: SettingsCallbackContext
  ) => Promise<SettingsInteractionResult>
}

export interface SettingsCheckboxNode extends SettingsControlBase {
  kind: 'checkbox'
  value: boolean
  onChange?: (
    value: boolean,
    context: SettingsCallbackContext
  ) => Promise<SettingsInteractionResult>
}

export interface SettingsSelectOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export interface SettingsSelectNode extends SettingsControlBase {
  kind: 'select'
  value?: string
  placeholder?: string
  options: readonly SettingsSelectOption[]
  onChange?: (value: string, context: SettingsCallbackContext) => Promise<SettingsInteractionResult>
}

export interface SettingsTextInputNode extends SettingsControlBase {
  kind: 'textInput'
  value?: string
  placeholder?: string
  inputMode?: 'text' | 'email' | 'url' | 'search' | 'tel' | 'password'
  onChange?: (value: string, context: SettingsCallbackContext) => Promise<SettingsInteractionResult>
}

export interface SettingsTextareaNode extends SettingsControlBase {
  kind: 'textarea'
  value?: string
  placeholder?: string
  rows?: number
  onChange?: (value: string, context: SettingsCallbackContext) => Promise<SettingsInteractionResult>
}

export interface SettingsNumberInputNode extends SettingsControlBase {
  kind: 'numberInput'
  value?: number
  placeholder?: string
  min?: number
  max?: number
  step?: number
  onChange?: (value: number, context: SettingsCallbackContext) => Promise<SettingsInteractionResult>
}

export interface SettingsButtonNode extends SettingsControlBase {
  kind: 'button'
  text?: string
  tone?: SettingsButtonTone
  onClick?: (
    value: undefined,
    context: SettingsCallbackContext
  ) => Promise<SettingsInteractionResult>
}

export interface SettingsDialogNode extends SettingsControlBase {
  kind: 'dialog'
  target: SettingsDialogTarget
}

export interface SettingsNoticeNode extends SettingsNodeBase {
  kind: 'notice'
  tone: SettingsNoticeTone
  text: string
}

export interface SettingsStatusNode extends SettingsNodeBase {
  kind: 'status'
  tone?: SettingsStatusTone
  label: string
  value: string
}

export interface SettingsDividerNode extends SettingsNodeBase {
  kind: 'divider'
}

export interface SettingsSectionNode extends SettingsNodeBase {
  kind: 'section'
  title?: string
  description?: string
  children: readonly SettingsNode[]
}

export type SettingsNode =
  | SettingsSectionNode
  | SettingsTextNode
  | SettingsSwitchNode
  | SettingsCheckboxNode
  | SettingsSelectNode
  | SettingsTextInputNode
  | SettingsTextareaNode
  | SettingsNumberInputNode
  | SettingsButtonNode
  | SettingsDialogNode
  | SettingsNoticeNode
  | SettingsStatusNode
  | SettingsDividerNode

export interface SettingsResolvedSwitchNode extends Omit<SettingsSwitchNode, 'onChange'> {
  callbackId?: string
}

export interface SettingsResolvedCheckboxNode extends Omit<SettingsCheckboxNode, 'onChange'> {
  callbackId?: string
}

export interface SettingsResolvedSelectNode extends Omit<SettingsSelectNode, 'onChange'> {
  callbackId?: string
}

export interface SettingsResolvedTextInputNode extends Omit<SettingsTextInputNode, 'onChange'> {
  callbackId?: string
}

export interface SettingsResolvedTextareaNode extends Omit<SettingsTextareaNode, 'onChange'> {
  callbackId?: string
}

export interface SettingsResolvedNumberInputNode extends Omit<SettingsNumberInputNode, 'onChange'> {
  callbackId?: string
}

export interface SettingsResolvedButtonNode extends Omit<SettingsButtonNode, 'onClick'> {
  callbackId?: string
}

export interface SettingsResolvedSectionNode extends Omit<SettingsSectionNode, 'children'> {
  children: readonly SettingsResolvedNode[]
}

export type SettingsResolvedNode =
  | SettingsResolvedSectionNode
  | SettingsTextNode
  | SettingsResolvedSwitchNode
  | SettingsResolvedCheckboxNode
  | SettingsResolvedSelectNode
  | SettingsResolvedTextInputNode
  | SettingsResolvedTextareaNode
  | SettingsResolvedNumberInputNode
  | SettingsResolvedButtonNode
  | SettingsDialogNode
  | SettingsNoticeNode
  | SettingsStatusNode
  | SettingsDividerNode

export interface SettingsScreenModel {
  title?: string
  description?: string
  size?: SettingsDialogSize
  nodes: readonly SettingsNode[]
}

export interface SettingsResolvedScreenModel extends Omit<SettingsScreenModel, 'nodes'> {
  nodes: readonly SettingsResolvedNode[]
}

export interface SettingsScreen {
  resolve(
    context: SettingsFrameContext,
    settings: SettingsBuilder
  ): Promise<SettingsScreenModel> | SettingsScreenModel
  submit?(
    event: SettingsSubmitEvent
  ): Promise<SettingsInteractionResult> | SettingsInteractionResult
}

export interface SettingsBuilder {
  screen(model: SettingsScreenModel): SettingsScreenModel
  section(node: Omit<SettingsSectionNode, 'kind'>): SettingsSectionNode
  text(node: Omit<SettingsTextNode, 'kind'>): SettingsTextNode
  switch(node: Omit<SettingsSwitchNode, 'kind'>): SettingsSwitchNode
  checkbox(node: Omit<SettingsCheckboxNode, 'kind'>): SettingsCheckboxNode
  select(node: Omit<SettingsSelectNode, 'kind'>): SettingsSelectNode
  textInput(node: Omit<SettingsTextInputNode, 'kind'>): SettingsTextInputNode
  textarea(node: Omit<SettingsTextareaNode, 'kind'>): SettingsTextareaNode
  numberInput(node: Omit<SettingsNumberInputNode, 'kind'>): SettingsNumberInputNode
  button(node: Omit<SettingsButtonNode, 'kind'>): SettingsButtonNode
  dialog(node: Omit<SettingsDialogNode, 'kind'>): SettingsDialogNode
  notice(node: Omit<SettingsNoticeNode, 'kind'>): SettingsNoticeNode
  status(node: Omit<SettingsStatusNode, 'kind'>): SettingsStatusNode
  divider(node: Omit<SettingsDividerNode, 'kind'>): SettingsDividerNode
}

export interface SettingsContribution {
  id: string
  title: string
  description?: string
  order?: number
  rootScreenId: string
  screens: Record<string, SettingsScreen>
}

export interface SettingsRegistrar {
  register(contribution: SettingsContribution): Disposable
}
