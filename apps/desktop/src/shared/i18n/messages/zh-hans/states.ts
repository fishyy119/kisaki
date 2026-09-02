import type { Messages } from '../schema'

/** Generic state and availability words: loading, toggles, presence. */
export const states = {
  loading: '正在加载…',
  saving: '正在保存…',
  processing: '正在处理…',
  enabled: '已启用',
  disabled: '已禁用',
  on: '开',
  off: '关',
  yes: '是',
  no: '否',
  all: '全部',
  none: '无',
  unknown: '未知',
  never: '从未',
  notSet: '未设置',
  notSpecified: '不指定',
  optional: '可选',
  required: '必填'
} satisfies Messages['states']
