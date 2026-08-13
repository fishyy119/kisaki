import type { Messages } from '../schema'

export const filter = {
  title: '筛选条件',
  clearFilters: '清除筛选',
  noActive: '无筛选条件',
  activeCount: ({ count }: { count: number }) => `${count} 个筛选`,
  conditionCount: ({ count }: { count: number }) => `${count} 个条件`,
  matchModeLabel: '匹配方式',
  matchAny: '任意',
  matchAll: '全部',
  addCondition: '添加条件',
  noConditions: '暂无条件，点击下方「添加条件」开始',
  ops: {
    is: '是',
    anyOf: '任一为',
    noneOf: '均不为',
    inRange: '介于',
    inDateRange: '介于',
    hasAnyOf: '包含任一',
    hasAllOf: '包含全部',
    hasNoneOf: '不包含',
    isEmpty: '为空',
    isSet: '不为空'
  },
  summaryAndMore: ({ first, count }: { first: string; count: number }) => `${first} 等 ${count} 项`,
  summaryFrom: ({ value }: { value: string }) => `从 ${value}`,
  summaryTo: ({ value }: { value: string }) => `到 ${value}`,
  minPlaceholder: '最小',
  maxPlaceholder: '最大',
  hoursUnit: '小时',
  favorite: '我喜欢'
} satisfies Messages['filter']
