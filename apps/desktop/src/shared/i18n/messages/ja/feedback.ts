import type { Messages } from '../schema'

/** Generic outcome toasts: saved, copied, and the matching failures. */
export const feedback = {
  saved: '保存しました',
  deleted: '削除しました',
  copied: 'コピーしました',
  saveFailed: '保存に失敗しました',
  deleteFailed: '削除に失敗しました',
  copyFailed: 'コピーに失敗しました',
  loadFailed: '読み込みに失敗しました',
  operationFailed: '操作に失敗しました'
} satisfies Messages['feedback']
