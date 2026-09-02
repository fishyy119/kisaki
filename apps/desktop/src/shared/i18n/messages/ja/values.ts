import type { Messages } from '../schema'

/** Value placeholders, empty states, and count formats. */
export const values = {
  emptyValue: '—',
  searchPlaceholder: '検索',
  noResults: '該当する結果はありません',
  noData: 'データはありません',
  itemCount: ({ count }) => `${count} 件`,
  selectedCount: ({ count }) => `${count} 件を選択中`
} satisfies Messages['values']
