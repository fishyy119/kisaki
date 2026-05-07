import type {
  SettingsAnyNodeEvents,
  SettingsButtonNode,
  SettingsCheckboxNode,
  SettingsDividerNode,
  SettingsImageNode,
  SettingsMultiSelectNode,
  SettingsNoticeNode,
  SettingsNumberInputNode,
  SettingsRecordListNode,
  SettingsSelectNode,
  SettingsStatusNode,
  SettingsStringListNode,
  SettingsSwitchNode,
  SettingsTableNode,
  SettingsTextInputNode,
  SettingsTextNode,
  SettingsTextareaNode
} from './nodes'

export interface SettingsNodeFactory<TEvents extends SettingsAnyNodeEvents> {
  switch(
    node: Omit<SettingsSwitchNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsSwitchNode<TEvents['commitEvent'], TEvents['commitResult']>
  checkbox(
    node: Omit<SettingsCheckboxNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsCheckboxNode<TEvents['commitEvent'], TEvents['commitResult']>
  select(
    node: Omit<SettingsSelectNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsSelectNode<TEvents['commitEvent'], TEvents['commitResult']>
  multiSelect(
    node: Omit<SettingsMultiSelectNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsMultiSelectNode<TEvents['commitEvent'], TEvents['commitResult']>
  textInput(
    node: Omit<SettingsTextInputNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsTextInputNode<TEvents['commitEvent'], TEvents['commitResult']>
  textarea(
    node: Omit<SettingsTextareaNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsTextareaNode<TEvents['commitEvent'], TEvents['commitResult']>
  numberInput(
    node: Omit<SettingsNumberInputNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsNumberInputNode<TEvents['commitEvent'], TEvents['commitResult']>
  stringList(
    node: Omit<SettingsStringListNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsStringListNode<TEvents['commitEvent'], TEvents['commitResult']>
  recordList(
    node: Omit<SettingsRecordListNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsRecordListNode<TEvents['commitEvent'], TEvents['commitResult']>
  button(
    node: Omit<SettingsButtonNode<TEvents['buttonEvent'], TEvents['buttonResult']>, 'kind'>
  ): SettingsButtonNode<TEvents['buttonEvent'], TEvents['buttonResult']>
  text(node: Omit<SettingsTextNode, 'kind'>): SettingsTextNode
  notice(node: Omit<SettingsNoticeNode, 'kind'>): SettingsNoticeNode
  status(node: Omit<SettingsStatusNode, 'kind'>): SettingsStatusNode
  table(node: Omit<SettingsTableNode, 'kind'>): SettingsTableNode
  image(node: Omit<SettingsImageNode, 'kind'>): SettingsImageNode
  divider(node?: Omit<SettingsDividerNode, 'kind'>): SettingsDividerNode
}
