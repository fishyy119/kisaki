import type { Messages } from '../schema'

export const common = {
  // Actions
  add: '追加',
  apply: '適用',
  back: '戻る',
  browse: '参照…',
  cancel: 'キャンセル',
  clear: 'クリア',
  close: '閉じる',
  confirm: '確認',
  copy: 'コピー',
  create: '作成',
  delete: '削除',
  edit: '編集',
  export: 'エクスポート',
  import: 'インポート',
  moveDown: '下へ移動',
  moveUp: '上へ移動',
  next: '次へ',
  open: '開く',
  preview: 'プレビュー',
  previous: '前へ',
  refresh: '更新',
  remove: '削除',
  rename: '名前を変更',
  reset: 'リセット',
  retry: '再試行',
  save: '保存',
  search: '検索',
  select: '選択',
  selectAll: 'すべて選択',
  view: '表示',

  // States
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
  required: '必須',

  // Feedback
  saved: '保存しました',
  deleted: '削除しました',
  copied: 'コピーしました',
  saveFailed: '保存に失敗しました',
  deleteFailed: '削除に失敗しました',
  copyFailed: 'コピーに失敗しました',
  loadFailed: '読み込みに失敗しました',
  operationFailed: '操作に失敗しました',

  // Placeholders and empty values
  emptyValue: '—',
  searchPlaceholder: '検索',
  noResults: '該当する結果はありません',
  noData: 'データはありません',

  // Counts
  itemCount: ({ count }) => `${count} 件`,
  selectedCount: ({ count }) => `${count} 件を選択中`
} satisfies Messages['common']
