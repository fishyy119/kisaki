import type { Messages } from '../schema'

export const filter = {
  title: 'フィルター条件',
  clearFilters: 'フィルターをクリア',
  noActive: 'フィルターなし',
  activeCount: ({ count }: { count: number }) => `${count} 件のフィルター`,
  conditionCount: ({ count }: { count: number }) => `${count} 件の条件`,
  matchAny: 'いずれか',
  matchAll: 'すべて',
  summaryAndMore: ({ first, count }: { first: string; count: number }) =>
    `${first} など ${count} 件`,
  summaryFrom: ({ value }: { value: string }) => `${value} から`,
  summaryTo: ({ value }: { value: string }) => `${value} まで`,
  minPlaceholder: '最小',
  maxPlaceholder: '最大',
  secondsUnit: '秒',
  favorite: 'お気に入り'
} satisfies Messages['filter']
