import type { Messages } from '../schema'

export const common = {
  // Actions
  add: '新增',
  apply: '套用',
  back: '返回',
  browse: '瀏覽…',
  cancel: '取消',
  clear: '清除',
  close: '關閉',
  confirm: '確認',
  copy: '複製',
  create: '建立',
  delete: '刪除',
  edit: '編輯',
  export: '匯出',
  import: '匯入',
  moveDown: '下移',
  moveUp: '上移',
  next: '下一步',
  open: '開啟',
  preview: '預覽',
  previous: '上一步',
  refresh: '重新整理',
  remove: '移除',
  rename: '重新命名',
  reset: '重設',
  retry: '重試',
  save: '儲存',
  search: '搜尋',
  select: '選取',
  selectAll: '全選',
  view: '檢視',

  // States
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
  required: '必填',

  // Feedback
  saved: '已儲存。',
  deleted: '已刪除。',
  copied: '已複製。',
  saveFailed: '儲存失敗。',
  deleteFailed: '刪除失敗。',
  copyFailed: '複製失敗。',
  loadFailed: '載入失敗。',
  operationFailed: '操作失敗。',

  // Placeholders and empty values
  emptyValue: '—',
  searchPlaceholder: '搜尋',
  noResults: '沒有符合的結果。',
  noData: '暫無資料。',

  // Counts
  itemCount: ({ count }) => `${count} 項`,
  selectedCount: ({ count }) => `已選取 ${count} 項`
} satisfies Messages['common']
