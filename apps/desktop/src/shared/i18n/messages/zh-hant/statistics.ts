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
    totalPlayTime: '總遊玩時長',
    flatVsPrevious: ({ label }: { label: string }) => `與${label}持平`,
    upVsPrevious: ({ label, duration }: { label: string; duration: string }) =>
      `較${label} +${duration}`,
    downVsPrevious: ({ label, duration }: { label: string; duration: string }) =>
      `較${label} -${duration}`,
    other: '其他',
    noPlayRecords: '暫無遊玩紀錄',
    mostPlayed: '最常玩',

    sessions: '遊玩次數',
    gamesPlayed: '遊玩數量',
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
    gamesValue: ({ count }: { count: number }) => `${count}款`,
    activeDaysValue: ({ active, total }: { active: number; total: number }) =>
      `${active}/${total}天`,
    daysValue: ({ count }: { count: number }) => `${count}天`
  },

  ranking: {
    gameTitle: '遊戲排行',
    collectionTitle: '收藏排行',
    sortTime: '時長',
    sortCount: '次數'
  },

  charts: {
    heatmapTitle: '活動熱力圖',
    trendTitle: '遊玩趨勢',
    distributionTitle: '時段分佈'
  }
} satisfies Messages['statistics']
