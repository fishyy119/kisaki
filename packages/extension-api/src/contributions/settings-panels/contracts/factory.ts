import type {
  SettingsPanelAnyNodeEvents,
  SettingsPanelButtonNode,
  SettingsPanelCheckboxNode,
  SettingsPanelDividerNode,
  SettingsPanelImageNode,
  SettingsPanelLinkNode,
  SettingsPanelMultiSelectNode,
  SettingsPanelNoticeNode,
  SettingsPanelNumberInputNode,
  SettingsPanelRadioGroupNode,
  SettingsPanelRecordListNode,
  SettingsPanelSelectNode,
  SettingsPanelStatusNode,
  SettingsPanelStringListNode,
  SettingsPanelSwitchNode,
  SettingsPanelTableNode,
  SettingsPanelTextInputNode,
  SettingsPanelTextNode,
  SettingsPanelTextareaNode
} from './nodes'

export interface SettingsPanelNodeFactory<TEvents extends SettingsPanelAnyNodeEvents> {
  switch(
    node: Omit<SettingsPanelSwitchNode<TEvents['changeEvent'], TEvents['changeResult']>, 'kind'>
  ): SettingsPanelSwitchNode<TEvents['changeEvent'], TEvents['changeResult']>
  checkbox(
    node: Omit<SettingsPanelCheckboxNode<TEvents['changeEvent'], TEvents['changeResult']>, 'kind'>
  ): SettingsPanelCheckboxNode<TEvents['changeEvent'], TEvents['changeResult']>
  select(
    node: Omit<SettingsPanelSelectNode<TEvents['changeEvent'], TEvents['changeResult']>, 'kind'>
  ): SettingsPanelSelectNode<TEvents['changeEvent'], TEvents['changeResult']>
  radioGroup(
    node: Omit<SettingsPanelRadioGroupNode<TEvents['changeEvent'], TEvents['changeResult']>, 'kind'>
  ): SettingsPanelRadioGroupNode<TEvents['changeEvent'], TEvents['changeResult']>
  multiSelect(
    node: Omit<
      SettingsPanelMultiSelectNode<TEvents['changeEvent'], TEvents['changeResult']>,
      'kind'
    >
  ): SettingsPanelMultiSelectNode<TEvents['changeEvent'], TEvents['changeResult']>
  textInput(
    node: Omit<SettingsPanelTextInputNode<TEvents['changeEvent'], TEvents['changeResult']>, 'kind'>
  ): SettingsPanelTextInputNode<TEvents['changeEvent'], TEvents['changeResult']>
  textarea(
    node: Omit<SettingsPanelTextareaNode<TEvents['changeEvent'], TEvents['changeResult']>, 'kind'>
  ): SettingsPanelTextareaNode<TEvents['changeEvent'], TEvents['changeResult']>
  numberInput(
    node: Omit<
      SettingsPanelNumberInputNode<TEvents['changeEvent'], TEvents['changeResult']>,
      'kind'
    >
  ): SettingsPanelNumberInputNode<TEvents['changeEvent'], TEvents['changeResult']>
  stringList(
    node: Omit<SettingsPanelStringListNode<TEvents['changeEvent'], TEvents['changeResult']>, 'kind'>
  ): SettingsPanelStringListNode<TEvents['changeEvent'], TEvents['changeResult']>
  recordList(
    node: Omit<SettingsPanelRecordListNode<TEvents['changeEvent'], TEvents['changeResult']>, 'kind'>
  ): SettingsPanelRecordListNode<TEvents['changeEvent'], TEvents['changeResult']>
  button(
    node: Omit<SettingsPanelButtonNode<TEvents['buttonEvent'], TEvents['buttonResult']>, 'kind'>
  ): SettingsPanelButtonNode<TEvents['buttonEvent'], TEvents['buttonResult']>
  text(node: Omit<SettingsPanelTextNode, 'kind'>): SettingsPanelTextNode
  notice(node: Omit<SettingsPanelNoticeNode, 'kind'>): SettingsPanelNoticeNode
  status(node: Omit<SettingsPanelStatusNode, 'kind'>): SettingsPanelStatusNode
  table(node: Omit<SettingsPanelTableNode, 'kind'>): SettingsPanelTableNode
  link(node: Omit<SettingsPanelLinkNode, 'kind'>): SettingsPanelLinkNode
  image(node: Omit<SettingsPanelImageNode, 'kind'>): SettingsPanelImageNode
  divider(node: Omit<SettingsPanelDividerNode, 'kind'>): SettingsPanelDividerNode
}
