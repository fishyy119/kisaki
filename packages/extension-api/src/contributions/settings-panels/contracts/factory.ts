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
    node: Omit<SettingsPanelSwitchNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsPanelSwitchNode<TEvents['commitEvent'], TEvents['commitResult']>
  checkbox(
    node: Omit<SettingsPanelCheckboxNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsPanelCheckboxNode<TEvents['commitEvent'], TEvents['commitResult']>
  select(
    node: Omit<SettingsPanelSelectNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsPanelSelectNode<TEvents['commitEvent'], TEvents['commitResult']>
  radioGroup(
    node: Omit<SettingsPanelRadioGroupNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsPanelRadioGroupNode<TEvents['commitEvent'], TEvents['commitResult']>
  multiSelect(
    node: Omit<
      SettingsPanelMultiSelectNode<TEvents['commitEvent'], TEvents['commitResult']>,
      'kind'
    >
  ): SettingsPanelMultiSelectNode<TEvents['commitEvent'], TEvents['commitResult']>
  textInput(
    node: Omit<SettingsPanelTextInputNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsPanelTextInputNode<TEvents['commitEvent'], TEvents['commitResult']>
  textarea(
    node: Omit<SettingsPanelTextareaNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsPanelTextareaNode<TEvents['commitEvent'], TEvents['commitResult']>
  numberInput(
    node: Omit<
      SettingsPanelNumberInputNode<TEvents['commitEvent'], TEvents['commitResult']>,
      'kind'
    >
  ): SettingsPanelNumberInputNode<TEvents['commitEvent'], TEvents['commitResult']>
  stringList(
    node: Omit<SettingsPanelStringListNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsPanelStringListNode<TEvents['commitEvent'], TEvents['commitResult']>
  recordList(
    node: Omit<SettingsPanelRecordListNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsPanelRecordListNode<TEvents['commitEvent'], TEvents['commitResult']>
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
