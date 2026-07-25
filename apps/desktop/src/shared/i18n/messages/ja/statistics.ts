import type { Messages } from '../schema'

/** Statistics: report pages, hero band, rankings, and chart modules. */
export const statistics = {
  title: '統計',

  tabs: {
    overview: '概要',
    weekly: '週報',
    monthly: '月報',
    yearly: '年報'
  },

  period: {
    pastYear: '過去 1 年',
    previousWeek: '先週',
    previousMonth: '先月',
    previousYear: '昨年',
    previousPeriod: '前の期間'
  },

  hero: {
    totalPlayTime: '合計プレイ時間',
    flatVsPrevious: ({ label }: { label: string }) => `${label}と同じ`,
    upVsPrevious: ({ label, duration }: { label: string; duration: string }) =>
      `${label}より +${duration}`,
    downVsPrevious: ({ label, duration }: { label: string; duration: string }) =>
      `${label}より -${duration}`,
    other: 'その他',
    noPlayRecords: 'プレイ記録はまだありません',
    mostPlayed: '最もプレイ',

    sessions: 'プレイ回数',
    gamesPlayed: 'プレイ本数',
    averageSession: '平均セッション',
    activeDays: 'アクティブ日数',
    dailyAverage: '1 日平均',
    mostActiveDay: '最も活発な曜日',
    weeklyAverage: '週平均',
    mostActiveWeek: '最も活発な週',
    monthlyAverage: '月平均',
    mostActiveMonth: '最も活発な月',
    longestSession: '最長セッション',
    currentStreak: '現在の連続日数',
    longestStreak: '最長の連続日数',

    timesValue: ({ count }: { count: number }) => `${count} 回`,
    gamesValue: ({ count }: { count: number }) => `${count} 本`,
    activeDaysValue: ({ active, total }: { active: number; total: number }) =>
      `${active}/${total} 日`,
    daysValue: ({ count }: { count: number }) => `${count} 日`
  },

  ranking: {
    gameTitle: 'ゲームランキング',
    collectionTitle: 'コレクションランキング',
    sortTime: '時間',
    sortCount: '回数'
  },

  charts: {
    heatmapTitle: 'アクティビティヒートマップ',
    trendTitle: 'プレイ推移',
    distributionTitle: '時間帯分布'
  }
} satisfies Messages['statistics']
