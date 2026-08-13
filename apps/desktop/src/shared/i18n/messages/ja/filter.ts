import type { Messages } from '../schema'

export const filter = {
  title: 'フィルター条件',
  clearFilters: 'フィルターをクリア',
  noActive: 'フィルターなし',
  activeCount: ({ count }: { count: number }) => `${count} 件のフィルター`,
  conditionCount: ({ count }: { count: number }) => `${count} 件の条件`,
  matchModeLabel: '一致条件',
  matchAny: 'いずれか',
  matchAll: 'すべて',
  addCondition: '条件を追加',
  noConditions: '条件がありません。下の「条件を追加」から追加できます',
  ops: {
    is: 'が次である',
    anyOf: 'のいずれか',
    noneOf: 'のいずれでもない',
    inRange: 'の範囲内',
    inDateRange: 'の範囲内',
    hasAnyOf: 'のいずれかを含む',
    hasAllOf: 'のすべてを含む',
    hasNoneOf: 'を含まない',
    isEmpty: 'が空',
    isSet: 'が設定済み'
  },
  summaryAndMore: ({ first, count }: { first: string; count: number }) =>
    `${first} など ${count} 件`,
  summaryFrom: ({ value }: { value: string }) => `${value} から`,
  summaryTo: ({ value }: { value: string }) => `${value} まで`,
  minPlaceholder: '最小',
  maxPlaceholder: '最大',
  hoursUnit: '時間',
  favorite: 'お気に入り'
} satisfies Messages['filter']
