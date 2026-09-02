import type { Messages } from '../schema'

/** Value placeholders, empty states, and count formats. */
export const values = {
  emptyValue: '—',
  searchPlaceholder: '搜尋',
  noResults: '沒有符合的結果',
  noData: '暫無資料',
  itemCount: ({ count }) => `${count} 項`,
  selectedCount: ({ count }) => `已選取 ${count} 項`
} satisfies Messages['values']
