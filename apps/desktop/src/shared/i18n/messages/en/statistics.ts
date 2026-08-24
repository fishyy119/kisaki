/** Statistics: report pages, hero band, rankings, and chart modules. */
export const statistics = {
  title: 'Statistics',

  tabs: {
    overview: 'Overview',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly'
  },

  period: {
    pastYear: 'Past year',
    previousWeek: 'last week',
    previousMonth: 'last month',
    previousYear: 'last year',
    previousPeriod: 'the previous period'
  },

  hero: {
    totalTime: 'Total activity time',
    flatVsPrevious: ({ label }: { label: string }) => `On par with ${label}`,
    upVsPrevious: ({ label, duration }: { label: string; duration: string }) =>
      `Up ${duration} vs ${label}`,
    downVsPrevious: ({ label, duration }: { label: string; duration: string }) =>
      `Down ${duration} vs ${label}`,
    other: 'Other',
    noActivityRecords: 'No activity yet',
    mostPlayed: 'Top title',

    sessions: 'Sessions',
    entitiesPlayed: 'Titles',
    averageSession: 'Average session',
    activeDays: 'Active days',
    dailyAverage: 'Daily average',
    mostActiveDay: 'Most active day',
    weeklyAverage: 'Weekly average',
    mostActiveWeek: 'Most active week',
    monthlyAverage: 'Monthly average',
    mostActiveMonth: 'Most active month',
    longestSession: 'Longest session',
    currentStreak: 'Current streak',
    longestStreak: 'Longest streak',

    timesValue: ({ count }: { count: number }) => (count === 1 ? '1 time' : `${count} times`),
    entitiesValue: ({ count }: { count: number }) => (count === 1 ? '1 title' : `${count} titles`),
    activeDaysValue: ({ active, total }: { active: number; total: number }) =>
      `${active}/${total} days`,
    daysValue: ({ count }: { count: number }) => (count === 1 ? '1 day' : `${count} days`)
  },

  ranking: {
    mediaTitle: 'Title ranking',
    collectionTitle: 'Collection ranking',
    sortTime: 'Time',
    sortCount: 'Count'
  },

  charts: {
    heatmapTitle: 'Activity heatmap',
    trendTitle: 'Activity trend',
    distributionTitle: 'Time distribution'
  }
}
