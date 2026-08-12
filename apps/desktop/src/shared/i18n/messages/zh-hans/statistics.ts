import type { Messages } from '../schema'

/** Statistics: report pages, hero band, rankings, and chart modules. */
export const statistics = {
  title: '统计',

  tabs: {
    overview: '总览',
    weekly: '周报',
    monthly: '月报',
    yearly: '年报'
  },

  period: {
    pastYear: '过去一年',
    previousWeek: '上周',
    previousMonth: '上月',
    previousYear: '去年',
    previousPeriod: '上一期'
  },

  hero: {
    totalTime: '总活动时长',
    flatVsPrevious: ({ label }: { label: string }) => `与${label}持平`,
    upVsPrevious: ({ label, duration }: { label: string; duration: string }) =>
      `较${label} +${duration}`,
    downVsPrevious: ({ label, duration }: { label: string; duration: string }) =>
      `较${label} -${duration}`,
    other: '其他',
    noActivityRecords: '暂无活动记录',
    mostPlayed: '最投入',

    sessions: '活动次数',
    entitiesPlayed: '作品数量',
    averageSession: '平均单次',
    activeDays: '活跃天数',
    dailyAverage: '日均时长',
    mostActiveDay: '最活跃日',
    weeklyAverage: '周均时长',
    mostActiveWeek: '最活跃周',
    monthlyAverage: '月均时长',
    mostActiveMonth: '最活跃月份',
    longestSession: '最长单次',
    currentStreak: '当前连续',
    longestStreak: '最长连续',

    timesValue: ({ count }: { count: number }) => `${count}次`,
    entitiesValue: ({ count }: { count: number }) => `${count}部`,
    activeDaysValue: ({ active, total }: { active: number; total: number }) =>
      `${active}/${total}天`,
    daysValue: ({ count }: { count: number }) => `${count}天`
  },

  ranking: {
    mediaTitle: '作品排行',
    collectionTitle: '收藏排行',
    sortTime: '时长',
    sortCount: '次数'
  },

  charts: {
    heatmapTitle: '活动热力图',
    trendTitle: '活动趋势',
    distributionTitle: '时段分布'
  }
} satisfies Messages['statistics']
