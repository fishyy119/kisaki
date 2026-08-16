/** Filter UI: panel, dialog, summary chips, condition editor, and spec-only field labels. */
export const filter = {
  title: 'Filters',
  clearFilters: 'Clear filters',
  noActive: 'No filters',
  activeCount: ({ count }: { count: number }) => (count === 1 ? '1 filter' : `${count} filters`),
  conditionCount: ({ count }: { count: number }) =>
    count === 1 ? '1 condition' : `${count} conditions`,
  matchModeLabel: 'Match',
  matchAny: 'Any',
  matchAll: 'All',
  addCondition: 'Add condition',
  noConditions: 'No conditions yet - use "Add condition" below to start',
  ops: {
    is: 'Is',
    anyOf: 'Any of',
    noneOf: 'None of',
    inRange: 'Between',
    inDateRange: 'Between',
    hasAnyOf: 'Has any of',
    hasAllOf: 'Has all of',
    hasNoneOf: 'Has none of',
    isEmpty: 'Is empty',
    isSet: 'Is set'
  },
  summaryAndMore: ({ first, count }: { first: string; count: number }) =>
    `${first} and ${count - 1} more`,
  summaryFrom: ({ value }: { value: string }) => `From ${value}`,
  summaryTo: ({ value }: { value: string }) => `To ${value}`,
  minPlaceholder: 'Min',
  maxPlaceholder: 'Max',
  hoursUnit: 'Hours',
  minutesUnit: 'Minutes',
  favorite: 'Favorite'
}
