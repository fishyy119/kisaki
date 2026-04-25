import type { Disposable, SerializableValue, UiCallbackResult } from '../../shared'

export type SettingsNoticeTone = 'info' | 'warning' | 'error' | 'success'

export type SettingsStatusTone = 'neutral' | 'success' | 'warning' | 'danger'

export type SettingsTextTone = 'default' | 'muted' | 'danger'

export type SettingsButtonTone = 'default' | 'primary' | 'danger'

export interface SettingsNodeBase {
  id: string
  hidden?: boolean
}

export interface SettingsControlBase extends SettingsNodeBase {
  label?: string
  description?: string
  disabled?: boolean
}

export interface SettingsPanelCallbackContext {
  panelId: string
  signal: AbortSignal
}

export interface SettingsSubmitEvent {
  panelId: string
  values: Record<string, SerializableValue>
  signal: AbortSignal
}

export interface SettingsTextNode extends SettingsNodeBase {
  kind: 'text'
  text: string
  tone?: SettingsTextTone
}

export interface SettingsSwitchNode extends SettingsControlBase {
  kind: 'switch'
  value: boolean
  onChange?: (value: boolean, context: SettingsPanelCallbackContext) => Promise<UiCallbackResult>
}

export interface SettingsCheckboxNode extends SettingsControlBase {
  kind: 'checkbox'
  value: boolean
  onChange?: (value: boolean, context: SettingsPanelCallbackContext) => Promise<UiCallbackResult>
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
  onChange?: (value: string, context: SettingsPanelCallbackContext) => Promise<UiCallbackResult>
}

export interface SettingsTextInputNode extends SettingsControlBase {
  kind: 'textInput'
  value?: string
  placeholder?: string
  inputMode?: 'text' | 'email' | 'url' | 'search' | 'tel' | 'password'
  onChange?: (value: string, context: SettingsPanelCallbackContext) => Promise<UiCallbackResult>
}

export interface SettingsTextareaNode extends SettingsControlBase {
  kind: 'textarea'
  value?: string
  placeholder?: string
  rows?: number
  onChange?: (value: string, context: SettingsPanelCallbackContext) => Promise<UiCallbackResult>
}

export interface SettingsNumberInputNode extends SettingsControlBase {
  kind: 'numberInput'
  value?: number
  placeholder?: string
  min?: number
  max?: number
  step?: number
  onChange?: (value: number, context: SettingsPanelCallbackContext) => Promise<UiCallbackResult>
}

export interface SettingsButtonNode extends SettingsControlBase {
  kind: 'button'
  text?: string
  tone?: SettingsButtonTone
  onClick?: (value: undefined, context: SettingsPanelCallbackContext) => Promise<UiCallbackResult>
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

export type SettingsPanelControlNode =
  | SettingsTextNode
  | SettingsSwitchNode
  | SettingsCheckboxNode
  | SettingsSelectNode
  | SettingsTextInputNode
  | SettingsTextareaNode
  | SettingsNumberInputNode
  | SettingsButtonNode
  | SettingsNoticeNode
  | SettingsStatusNode
  | SettingsDividerNode

export interface SettingsSectionNode extends SettingsNodeBase {
  kind: 'section'
  title: string
  description?: string
  controls: readonly SettingsPanelControlNode[]
}

export type SettingsPanelNode =
  | SettingsSectionNode
  | SettingsTextNode
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

export type SettingsPanelResolvedControlNode =
  | SettingsTextNode
  | SettingsResolvedSwitchNode
  | SettingsResolvedCheckboxNode
  | SettingsResolvedSelectNode
  | SettingsResolvedTextInputNode
  | SettingsResolvedTextareaNode
  | SettingsResolvedNumberInputNode
  | SettingsResolvedButtonNode
  | SettingsNoticeNode
  | SettingsStatusNode
  | SettingsDividerNode

export interface SettingsResolvedSectionNode extends Omit<SettingsSectionNode, 'controls'> {
  controls: readonly SettingsPanelResolvedControlNode[]
}

export type SettingsPanelResolvedNode =
  | SettingsResolvedSectionNode
  | SettingsTextNode
  | SettingsNoticeNode
  | SettingsStatusNode
  | SettingsDividerNode

export interface SettingsPanelBuilder {
  section(node: Omit<SettingsSectionNode, 'kind'>): SettingsSectionNode
  text(node: Omit<SettingsTextNode, 'kind'>): SettingsTextNode
  switch(node: Omit<SettingsSwitchNode, 'kind'>): SettingsSwitchNode
  checkbox(node: Omit<SettingsCheckboxNode, 'kind'>): SettingsCheckboxNode
  select(node: Omit<SettingsSelectNode, 'kind'>): SettingsSelectNode
  textInput(node: Omit<SettingsTextInputNode, 'kind'>): SettingsTextInputNode
  textarea(node: Omit<SettingsTextareaNode, 'kind'>): SettingsTextareaNode
  numberInput(node: Omit<SettingsNumberInputNode, 'kind'>): SettingsNumberInputNode
  button(node: Omit<SettingsButtonNode, 'kind'>): SettingsButtonNode
  notice(node: Omit<SettingsNoticeNode, 'kind'>): SettingsNoticeNode
  status(node: Omit<SettingsStatusNode, 'kind'>): SettingsStatusNode
  divider(node: Omit<SettingsDividerNode, 'kind'>): SettingsDividerNode
}

export interface SettingsPanelContribution {
  id: string
  title: string
  description?: string
  order?: number
  resolve(panel: SettingsPanelBuilder): Promise<readonly SettingsPanelNode[]>
  onSubmit?(event: SettingsSubmitEvent): Promise<UiCallbackResult>
}

/**
 * Registrar for the extension's single settings panel.
 *
 * An extension may register at most one settings panel at a time. Dispose the
 * previous panel before registering a replacement.
 */
export interface SettingsPanelRegistrar {
  register(contribution: SettingsPanelContribution): Disposable
}
