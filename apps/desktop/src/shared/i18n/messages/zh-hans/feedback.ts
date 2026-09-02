import type { Messages } from '../schema'

/** Generic outcome toasts: saved, copied, and the matching failures. */
export const feedback = {
  saved: '已保存',
  deleted: '已删除',
  copied: '已复制',
  saveFailed: '保存失败',
  deleteFailed: '删除失败',
  copyFailed: '复制失败',
  loadFailed: '加载失败',
  operationFailed: '操作失败'
} satisfies Messages['feedback']
