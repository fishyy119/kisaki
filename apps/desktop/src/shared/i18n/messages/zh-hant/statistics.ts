import type { Messages } from '../schema'

/** Statistics: report pages, hero band, rankings, and chart modules. */
export const statistics = {
  title: '統計',

  tabs: {
    overview: '總覽',
    weekly: '週報',
    monthly: '月報',
    yearly: '年報'
  },

  period: {
    pastYear: '過去一年',
    previousWeek: '上週',
    previousMonth: '上月',
    previousYear: '去年',
    previousPeriod: '上一期'
  },

  hero: {
    totalTime: '總活動時長',
    flatVsPrevious: ({ label }: { label: string }) => `與${label}持平`,
    upVsPrevious: ({ label, duration }: { label: string; duration: string }) =>
      `較${label} +${duration}`,
    downVsPrevious: ({ label, duration }: { label: string; duration: string }) =>
      `較${label} -${duration}`,
    other: '其他',
    noActivityRecords: '暫無活動紀錄',
    mostPlayed: '最投入',

    sessions: '活動次數',
    entitiesPlayed: '作品數量',
    averageSession: '平均單次',
    activeDays: '活躍天數',
    dailyAverage: '日均時長',
    mostActiveDay: '最活躍日',
    weeklyAverage: '週均時長',
    mostActiveWeek: '最活躍週',
    monthlyAverage: '月均時長',
    mostActiveMonth: '最活躍月份',
    longestSession: '最長單次',
    currentStreak: '目前連續',
    longestStreak: '最長連續',

    timesValue: ({ count }: { count: number }) => `${count}次`,
    entitiesValue: ({ count }: { count: number }) => `${count}部`,
    activeDaysValue: ({ active, total }: { active: number; total: number }) =>
      `${active}/${total}天`,
    daysValue: ({ count }: { count: number }) => `${count}天`,

    units: {
      anime: { label: '看完話數', value: ({ count }: { count: number }) => `${count}話` },
      comic: { label: '讀完單元', value: ({ count }: { count: number }) => `${count}個` },
      novel: { label: '讀完卷數', value: ({ count }: { count: number }) => `${count}卷` }
    }
  },

  ranking: {
    mediaTitle: '作品排行',
    collectionTitle: '收藏排行',
    sortTime: '時長',
    sortCount: '次數'
  },

  charts: {
    heatmapTitle: '活動熱力圖',
    trendTitle: '活動趨勢',
    distributionTitle: '時段分佈',
    dayOfMonthLabel: ({ day }: { day: number }) => `${day}日`
  }
} satisfies Messages['statistics']
