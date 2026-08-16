import type { Messages } from '../schema'

export const movie = {
  watchStart: '观看',
  watchContinue: '继续观看',
  watchAgain: '重看',
  stop: '停止',
  showDetail: '查看详情',

  watch: {
    watched: '已看',
    unwatched: '未看',
    markWatched: '标记为已看',
    markUnwatched: '标记为未看',
    watchedUpdated: '观看状态已更新。',
    resumeAt: ({ position }: { position: string }) => `从 ${position} 继续`,
    clearResume: '清除续播位置',
    resumeCleared: '续播位置已清除。',
    playCount: '播放次数',
    watchedAt: '观看时间',
    resumeLabel: '续播位置',
    runtime: '片长'
  },

  extras: {
    title: '特典',
    emptyTitle: '暂无特典',
    emptyHint: '目录中的预告片与删减片段会出现在这里。',
    entityLabel: '特典',
    addExtra: '添加特典',
    extraAttached: '特典已添加',
    editTitle: '编辑特典',
    extraUpdated: '特典已更新',
    deleteExtra: '删除特典',
    extraRemoved: '特典记录已移除',
    play: '播放',
    playFailed: '播放特典失败',
    stopFailed: '停止特典失败',
    nameLabel: '名称',
    typeLabel: '类型',
    autoDetect: '自动识别'
  },

  files: {
    title: '版本',
    emptyTitle: '暂无文件',
    emptyHint: '扫描电影目录或添加文件后即可播放。',
    playFile: '播放此文件',
    missingFile: '无文件',
    noFiles: '暂无文件。',
    fileCount: ({ count }: { count: number }) => `${count} 个文件`,
    primary: '主文件',
    editionLabel: '版本',
    editionPlaceholder: '剧场版、导演剪辑版……',
    editionSaved: '版本已保存。',
    resolution: '分辨率',
    codec: '编码',
    audioTracks: '音轨',
    subtitleTracks: '字幕轨',
    audioTrackCount: ({ count }: { count: number }) => `${count} 条音轨`,
    subtitleTrackCount: ({ count }: { count: number }) => `${count} 条字幕轨`,
    openFolder: '打开所在文件夹',
    openFolderFailed: '无法打开所在文件夹。',
    setPrimary: '设为主文件',
    primaryUpdated: '主文件已更新。',
    removeFile: '移除文件记录',
    fileRemoved: '文件记录已移除。',
    recordEntityLabel: '文件记录',
    addFile: '添加文件',
    fileAttached: '文件已关联。',
    attachFailed: '无法关联该文件。',
    manualBadge: '手动',
    noteLabel: '备注',
    editNote: '编辑备注',
    noteSaved: '备注已保存。',

    syncFiles: '同步文件',
    syncCompleted: ({ files, extras }: { files: number; extras: number }) =>
      `已同步 ${files} 个文件与 ${extras} 个特典。`,
    syncFailed: '文件同步失败。'
  },

  player: {
    pause: '暂停',
    resume: '继续',
    pauseFailed: '无法暂停播放。',
    resumeFailed: '无法继续播放。'
  },

  detail: {
    openMovieDir: '打开电影目录',
    movieDirNotSet: '尚未设置电影目录。',
    watchStatus: '观看状态'
  },

  filesConfig: {
    title: '文件配置',
    movieDirLabel: '电影目录',
    movieDirPlaceholder: '未设置',
    selectDir: '选择目录',
    movieDirHint:
      '文件同步会扫描该目录中的正片版本与特典；留空则完全手动管理文件。保存修改会重新同步文件。'
  },

  statusDialog: {
    title: '编辑观看状态',
    label: '观看状态',
    selectStatus: '选择状态'
  },

  lastActiveDialog: {
    title: '编辑最近观看时间',
    label: '最近观看时间',
    emptyHint: '留空表示从未观看。'
  },

  duration: {
    title: '编辑观看时长',
    totalTime: '总观看时长',
    sessionsDuration: ({ value }: { value: string }) => `记录时长：${value}`,
    untrackedDuration: ({ value }: { value: string }) => `未记录：${value}`,
    untrackedLabel: '未记录观看时长',
    hoursUnit: '小时',
    minutesUnit: '分钟',
    untrackedHint: '未被会话记录覆盖的观看时长（例如导入的历史记录）。',
    sessionsHeader: ({ count }: { count: number }) => `观看记录（${count}）`,
    emptySessions: '暂无观看记录，可在下方添加。',
    addRecord: '添加记录',
    editRecord: '编辑记录',
    startTime: '开始时间',
    endTime: '结束时间',
    startEndRequired: '请填写开始与结束时间。',
    endAfterStart: '结束时间必须晚于开始时间。',
    overlap: '时间区间与已有记录重叠。',
    recordAdded: '记录已添加',
    recordUpdated: '记录已更新',
    recordDeleted: '记录已删除',
    deleteRecordDescription: '删除这条观看记录？此操作无法撤销。'
  },

  activity: {
    emptyTitle: '暂无观看记录',
    emptyHint: '开始观看后，观看时长会自动记录在这里。',
    statsOverview: '数据概览',
    heatmap: '活跃热力图',
    trend: '观看趋势',
    distribution: '时段分布',
    recentSessions: '最近记录',
    totalDuration: '观看时长',
    sessionCount: '观看次数',
    sessionCountValue: ({ count }: { count: number }) => `${count} 次`,
    avgDuration: '平均时长',
    longestSession: '最长单次',
    currentStreak: '当前连续',
    longestStreak: '最长连续',
    streakValue: ({ days }: { days: number }) => `${days} 天`,
    firstSession: '首次观看',
    lastSession: '最近观看',
    dayOfMonthLabel: ({ day }: { day: number }) => `${day} 日`
  }
} satisfies Messages['movie']
