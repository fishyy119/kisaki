import type { Messages } from '../schema'

export const filter = {
  title: '篩選條件',
  clearFilters: '清除篩選',
  noActive: '無篩選條件',
  activeCount: ({ count }: { count: number }) => `${count} 個篩選`,
  conditionCount: ({ count }: { count: number }) => `${count} 個條件`,
  matchModeLabel: '匹配方式',
  matchAny: '任意',
  matchAll: '全部',
  addCondition: '新增條件',
  noConditions: '暫無條件，點擊下方「新增條件」開始',
  ops: {
    is: '是',
    anyOf: '任一為',
    noneOf: '均不為',
    inRange: '介於',
    inDateRange: '介於',
    hasAnyOf: '包含任一',
    hasAllOf: '包含全部',
    hasNoneOf: '不包含',
    isEmpty: '為空',
    isSet: '不為空'
  },
  summaryAndMore: ({ first, count }: { first: string; count: number }) => `${first} 等 ${count} 項`,
  summaryFrom: ({ value }: { value: string }) => `從 ${value}`,
  summaryTo: ({ value }: { value: string }) => `到 ${value}`,
  minPlaceholder: '最小',
  maxPlaceholder: '最大',
  secondsUnit: '秒',
  favorite: '我喜歡'
} satisfies Messages['filter']
