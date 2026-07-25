import type { Messages } from '../schema'

export const filter = {
  title: '筛选条件',
  clearFilters: '清除筛选',
  noActive: '无筛选条件',
  activeCount: ({ count }: { count: number }) => `${count} 个筛选`,
  conditionCount: ({ count }: { count: number }) => `${count} 个条件`,
  matchAny: '任意',
  matchAll: '全部',
  summaryAndMore: ({ first, count }: { first: string; count: number }) => `${first} 等 ${count} 项`,
  summaryFrom: ({ value }: { value: string }) => `从 ${value}`,
  summaryTo: ({ value }: { value: string }) => `到 ${value}`,
  minPlaceholder: '最小',
  maxPlaceholder: '最大',
  secondsUnit: '秒',
  favorite: '我喜欢'
} satisfies Messages['filter']
