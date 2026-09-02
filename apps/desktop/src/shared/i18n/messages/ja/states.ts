import type { Messages } from '../schema'

/** Generic state and availability words: loading, toggles, presence. */
export const states = {
  loading: '読み込んでいます…',
  saving: '保存しています…',
  processing: '処理しています…',
  enabled: '有効',
  disabled: '無効',
  on: 'オン',
  off: 'オフ',
  yes: 'はい',
  no: 'いいえ',
  all: 'すべて',
  none: 'なし',
  unknown: '不明',
  never: '未実行',
  notSet: '未設定',
  notSpecified: '指定しない',
  optional: '任意',
  required: '必須'
} satisfies Messages['states']
