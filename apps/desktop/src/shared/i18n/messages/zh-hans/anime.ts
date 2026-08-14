import type { Messages } from '../schema'

export const anime = {
  watchStart: '开始观看',
  watchContinue: '继续观看',
  watchNext: '看下一集',
  stop: '停止',
  showDetail: '查看详情',
  starting: '启动中',
  playing: '播放中',

  episodes: {
    title: '剧集',
    emptyTitle: '暂无剧集',
    emptyHint: '扫描动漫目录或刮削元数据后，剧集会出现在这里。',
    unnamed: ({ number }: { number: string }) => `第 ${number} 话`,
    entityLabel: '剧集',
    watched: '已看',
    unwatched: '未看',
    stillEntityLabel: '剧照',
    resumeAt: ({ position }: { position: string }) => `从 ${position} 继续`,
    markWatched: '标记为已看',
    markUnwatched: '标记为未看',
    watchedUpdated: '观看状态已更新。',
    progress: ({ watched, total }: { watched: number; total: number }) =>
      `已看 ${watched} / ${total}`,
    playCount: '播放次数',
    watchedAt: '观看时间',
    resumeLabel: '续播位置',
    airDate: '放送日',

    addEpisode: '新增剧集',
    editEpisode: '编辑剧集',
    deleteEpisode: '删除剧集',
    episodeDeleted: '剧集已删除。',
    numberLabel: '集数',
    numberPlaceholder: '可留空',
    typeLabel: '类型',
    durationMinutes: '时长（分钟）',
    numberInvalid: '集数必须为正数。',
    durationInvalid: '时长必须为正数。',

    syncFiles: '同步文件',
    syncCompleted: ({
      episodes,
      files,
      extras
    }: {
      episodes: number
      files: number
      extras: number
    }) => `已同步 ${episodes} 个剧集、${files} 个文件、${extras} 个特典。`,
    syncFailed: '文件同步失败。',
    syncUnrecognized: ({ count }: { count: number }) => `${count} 个文件无法识别集数。`
  },

  extras: {
    title: '特典',
    emptyTitle: '暂无特典',
    emptyHint: '目录中的预告片、无字 OP/ED 会出现在这里。',
    entityLabel: '特典',
    addExtra: '添加特典',
    extraAttached: '特典已添加',
    editTitle: '编辑特典',
    extraUpdated: '特典已更新',
    deleteExtra: '删除特典',
    extraRemoved: '特典记录已删除',
    play: '播放',
    playFailed: '播放特典失败',
    stopFailed: '停止播放特典失败',
    nameLabel: '名称',
    typeLabel: '类型',
    autoDetect: '自动识别'
  },

  files: {
    title: '文件',
    playFile: '播放此文件',
    missingFile: '缺少文件',
    noFiles: '暂无文件。',
    fileCount: ({ count }: { count: number }) => `${count} 个文件`,
    primary: '首选',
    resolution: '分辨率',
    codec: '编码',
    audioTracks: '音轨',
    subtitleTracks: '字幕轨',
    audioTrackCount: ({ count }: { count: number }) => `${count} 音轨`,
    subtitleTrackCount: ({ count }: { count: number }) => `${count} 字幕轨`,
    openFolder: '打开所在文件夹',
    openFolderFailed: '无法打开所在文件夹。',
    setPrimary: '设为首选',
    primaryUpdated: '首选文件已更新。',
    removeFile: '移除文件记录',
    fileRemoved: '文件记录已移除。',
    recordEntityLabel: '文件记录',
    addFile: '添加文件',
    fileAttached: '文件已添加。',
    attachFailed: '添加文件失败。',
    manualBadge: '手动',
    noteLabel: '备注',
    editNote: '编辑备注',
    noteSaved: '备注已保存。'
  },

  player: {
    pause: '暂停',
    resume: '继续播放',
    paused: '已暂停',
    pauseFailed: '无法暂停播放。',
    resumeFailed: '无法继续播放。'
  },

  detail: {
    openAnimeDir: '打开动漫目录',
    animeDirNotSet: '尚未设置动漫目录。',
    watchStatus: '观看状态'
  },

  filesConfig: {
    title: '文件配置',
    animeDirLabel: '动漫目录',
    animeDirPlaceholder: '未设置',
    selectDir: '选择目录',
    animeDirHint:
      '同步会扫描此目录来匹配剧集文件；留空则完全手动管理文件。保存修改后会自动重新同步。',
    offsetLabel: '文件集数偏移',
    offsetHint: '文件集数 − 偏移 = 元数据集数，用于对齐绝对集数命名的文件。',
    offsetInvalid: '偏移必须为整数。'
  },

  statusDialog: {
    title: '编辑观看状态',
    label: '观看状态',
    selectStatus: '选择状态'
  },

  lastActiveDialog: {
    title: '编辑最近观看时间',
    label: '最近观看时间',
    emptyHint: '留空表示从未观看过。'
  },

  duration: {
    title: '编辑观看时间',
    totalTime: '总观看时间',
    sessionsDuration: ({ value }: { value: string }) => `会话记录：${value}`,
    untrackedDuration: ({ value }: { value: string }) => `未记录时间：${value}`,
    untrackedLabel: '未记录的观看时间',
    hoursUnit: '小时',
    minutesUnit: '分钟',
    untrackedHint: '观看会话未记录的观看时间（如导入的历史数据）。',
    sessionsHeader: ({ count }: { count: number }) => `会话记录（${count}）`,
    emptySessions: '暂无会话记录，点击下方按钮添加',
    addRecord: '添加记录',
    editRecord: '编辑记录',
    startTime: '开始时间',
    endTime: '结束时间',
    startEndRequired: '请填写开始和结束时间',
    endAfterStart: '结束时间必须晚于开始时间',
    overlap: '时间段与现有记录重叠，请调整时间',
    recordAdded: '已添加记录',
    recordUpdated: '已更新记录',
    recordDeleted: '已删除记录',
    deleteRecordDescription: '确定要删除这条会话记录吗？此操作无法撤销。'
  },

  activity: {
    emptyTitle: '暂无观看记录',
    emptyHint: '开始播放剧集后，观看时长会自动记录在这里。',
    statsOverview: '统计概览',
    heatmap: '活动热力图',
    trend: '观看趋势',
    distribution: '时段分布',
    recentSessions: '最近观看',
    totalDuration: '观看时长',
    sessionCount: '观看次数',
    sessionCountValue: ({ count }: { count: number }) => `${count} 次`,
    avgDuration: '平均单次',
    longestSession: '最长单次',
    currentStreak: '当前连续',
    longestStreak: '最长连续',
    streakValue: ({ days }: { days: number }) => `${days} 天`,
    firstSession: '首次观看',
    lastSession: '最近观看',
    dayOfMonthLabel: ({ day }: { day: number }) => `${day}日`
  }
} satisfies Messages['anime']
