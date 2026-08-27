import type { Messages } from '@shared/i18n'

export const novel = {
  readStart: '开始阅读',
  readContinue: '继续阅读',
  stop: '停止',
  volumes: {
    title: '卷',
    emptyTitle: '还没有卷',
    emptyHint: '扫描小说文件夹或抓取元数据以生成卷列表',
    unnamed: ({ number }: { number: string }) => `第${number}卷`,
    entityLabel: '卷',
    read: '已读',
    unread: '未读',
    resumeProgress: ({ percent }: { percent: number }) => `从 ${percent}% 继续`,
    markRead: '标记为已读',
    markUnread: '标记为未读',
    readUpdated: '阅读状态已更新',
    progress: ({ read, total }: { read: number; total: number }) => `已读 ${read} / ${total}`,
    readCount: '阅读次数',
    readAt: '读完时间',
    releaseDate: '发行日期',

    catchUp: {
      title: '将剩余卷标记为已读？',
      pendingCount: ({ count }: { count: number }) => `${count} 卷尚未标记为已读`,
      hint: '仅记录阅读状态，不记录阅读时间',
      markAll: '全部标记',
      skip: '跳过',
      marked: ({ count }: { count: number }) => `已将 ${count} 卷标记为已读`
    },

    addVolume: '添加卷',
    editVolume: '编辑卷',
    deleteVolume: '删除卷',
    volumeDeleted: '卷已删除',
    numberLabel: '卷号',
    numberPlaceholder: '可选',
    numberInvalid: '卷号必须为正数',
    numberRequired: '卷需要卷号或名称',

    syncFiles: '同步文件',
    syncCompleted: ({ volumes, files }: { volumes: number; files: number }) =>
      `已同步 ${volumes} 卷、${files} 个文件`,
    syncFailed: '文件同步失败',
    syncUnrecognized: ({ count }: { count: number }) => `${count} 个文件无法识别卷号`
  },

  files: {
    title: '文件',
    readFile: '阅读此文件',
    missingFile: '无文件',
    noFiles: '还没有文件',
    fileCount: ({ count }: { count: number }) => `${count} 个文件`,
    primary: '主文件',
    openFolder: '打开所在文件夹',
    openFolderFailed: '无法打开所在文件夹',
    setPrimary: '设为主文件',
    primaryUpdated: '主文件已更新',
    removeFile: '移除文件记录',
    fileRemoved: '文件记录已移除',
    recordEntityLabel: '文件记录',
    addFile: '添加文件',
    fileAttached: '文件已添加',
    attachFailed: '无法添加文件',
    manualBadge: '手动',
    noteLabel: '备注',
    editNote: '编辑备注',
    noteSaved: '备注已保存'
  },

  detail: {
    openNovelDir: '打开小说文件夹',
    novelDirNotSet: '未设置小说文件夹',
    readStatus: '阅读状态'
  },

  filesConfig: {
    title: '文件配置',
    novelDirLabel: '小说文件夹',
    novelDirPlaceholder: '未设置',
    selectDir: '选择文件夹',
    novelDirHint:
      '文件同步会扫描该文件夹以匹配卷文件；留空则完全手动管理文件。保存修改后会重新同步文件。'
  },

  statusDialog: {
    title: '编辑阅读状态',
    label: '阅读状态',
    selectStatus: '选择状态'
  },

  lastActiveDialog: {
    title: '编辑最后阅读时间',
    label: '最后阅读时间',
    emptyHint: '留空表示从未阅读'
  },

  duration: {
    title: '编辑阅读时长',
    totalTime: '总阅读时长',
    sessionsDuration: ({ value }: { value: string }) => `会话：${value}`,
    untrackedDuration: ({ value }: { value: string }) => `未跟踪：${value}`,
    untrackedLabel: '未跟踪阅读时长',
    hoursUnit: '小时',
    minutesUnit: '分钟',
    untrackedHint: '未被会话覆盖的阅读时长（如导入的历史记录）',
    sessionsHeader: ({ count }: { count: number }) => `会话（${count}）`,
    emptySessions: '还没有会话记录，在下方添加。',
    addRecord: '添加记录',
    editRecord: '编辑记录',
    startTime: '开始时间',
    endTime: '结束时间',
    startEndRequired: '请填写开始和结束时间',
    endAfterStart: '结束时间必须晚于开始时间',
    overlap: '时间范围与现有记录重叠',
    recordAdded: '记录已添加',
    recordUpdated: '记录已更新',
    recordDeleted: '记录已删除',
    deleteRecordDescription: '删除该会话记录？此操作无法撤销。'
  },

  activity: {
    emptyTitle: '还没有阅读活动',
    emptyHint: '开始阅读卷后会自动记录阅读时长',
    statsOverview: '统计概览',
    heatmap: '活动热力图',
    trend: '阅读趋势',
    distribution: '时段分布',
    recentSessions: '最近会话',
    totalDuration: '阅读时长',
    sessionCount: '会话数',
    sessionCountValue: ({ count }: { count: number }) => `${count} 次会话`,
    avgDuration: '平均会话',
    longestSession: '最长会话',
    currentStreak: '当前连续',
    longestStreak: '最长连续',
    streakValue: ({ days }: { days: number }) => `${days} 天`,
    firstSession: '首次阅读',
    lastSession: '最后阅读',
    dayOfMonthLabel: ({ day }: { day: number }) => `${day} 日`
  }
} satisfies Messages['novel']
