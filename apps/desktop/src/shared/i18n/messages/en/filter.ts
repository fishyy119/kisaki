/** Filter UI: panel, dialog, summary chips, and spec-only field labels. */
export const filter = {
  title: 'Filters',
  clearFilters: 'Clear filters',
  noActive: 'No filters',
  activeCount: ({ count }: { count: number }) => (count === 1 ? '1 filter' : `${count} filters`),
  conditionCount: ({ count }: { count: number }) =>
    count === 1 ? '1 condition' : `${count} conditions`,
  matchAny: 'Any',
  matchAll: 'All',
  summaryAndMore: ({ first, count }: { first: string; count: number }) =>
    `${first} and ${count - 1} more`,
  summaryFrom: ({ value }: { value: string }) => `From ${value}`,
  summaryTo: ({ value }: { value: string }) => `To ${value}`,
  minPlaceholder: 'Min',
  maxPlaceholder: 'Max',
  secondsUnit: 'Seconds',
  favorite: 'Favorite'
}
