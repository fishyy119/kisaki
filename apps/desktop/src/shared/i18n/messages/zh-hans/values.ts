import type { Messages } from '../schema'

/** Value placeholders, empty states, and count formats. */
export const values = {
  emptyValue: '—',
  searchPlaceholder: '搜索',
  noResults: '没有匹配的结果',
  noData: '暂无数据',
  itemCount: ({ count }) => `${count} 项`,
  selectedCount: ({ count }) => `已选择 ${count} 项`
} satisfies Messages['values']
