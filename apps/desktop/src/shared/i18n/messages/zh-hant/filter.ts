import type { Messages } from '../schema'

export const filter = {
  title: '篩選條件',
  clearFilters: '清除篩選',
  noActive: '無篩選條件',
  activeCount: ({ count }: { count: number }) => `${count} 個篩選`,
  conditionCount: ({ count }: { count: number }) => `${count} 個條件`,
  matchAny: '任意',
  matchAll: '全部',
  summaryAndMore: ({ first, count }: { first: string; count: number }) => `${first} 等 ${count} 項`,
  summaryFrom: ({ value }: { value: string }) => `從 ${value}`,
  summaryTo: ({ value }: { value: string }) => `到 ${value}`,
  minPlaceholder: '最小',
  maxPlaceholder: '最大',
  secondsUnit: '秒',
  favorite: '我喜歡'
} satisfies Messages['filter']
