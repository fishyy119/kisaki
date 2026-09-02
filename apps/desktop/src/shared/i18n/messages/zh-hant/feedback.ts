import type { Messages } from '../schema'

/** Generic outcome toasts: saved, copied, and the matching failures. */
export const feedback = {
  saved: '已儲存',
  deleted: '已刪除',
  copied: '已複製',
  saveFailed: '儲存失敗',
  deleteFailed: '刪除失敗',
  copyFailed: '複製失敗',
  loadFailed: '載入失敗',
  operationFailed: '操作失敗'
} satisfies Messages['feedback']
