/** Value placeholders, empty states, and count formats. */
export const values = {
  emptyValue: '—',
  searchPlaceholder: 'Search',
  noResults: 'No results',
  noData: 'No data',
  itemCount: ({ count }: { count: number }) => (count === 1 ? '1 item' : `${count} items`),
  selectedCount: ({ count }: { count: number }) =>
    count === 1 ? '1 selected' : `${count} selected`
}
