import type { Messages } from '../schema'

/** Generic state and availability words: loading, toggles, presence. */
export const states = {
  loading: '正在載入…',
  saving: '正在儲存…',
  processing: '正在處理…',
  enabled: '已啟用',
  disabled: '已停用',
  on: '開',
  off: '關',
  yes: '是',
  no: '否',
  all: '全部',
  none: '無',
  unknown: '未知',
  never: '從未',
  notSet: '未設定',
  notSpecified: '不指定',
  optional: '選填',
  required: '必填'
} satisfies Messages['states']
