import type { Messages } from '../schema'

export const tv = {
  watchStart: '開始觀看',
  watchContinue: '繼續觀看',
  watchNext: '看下一集',
  stop: '停止',
  showDetail: '查看詳情',

  seasons: {
    title: '季',
    entityLabel: '季',
    specials: '特別篇',
    unnamed: ({ number }: { number: number }) => `第 ${number} 季`,
    seasonCount: ({ count }: { count: number }) => `${count} 季`,
    posterEntityLabel: '季海報',
    airDate: '首播日',
    addSeason: '新增季',
    editSeason: '編輯季',
    deleteSeason: '刪除季',
    seasonDeleted: '季已刪除。',
    numberLabel: '季編號',
    numberHint: '特別篇請使用 0。',
    numberInvalid: '季編號必須大於等於 0。',
    numberTaken: '該季編號已被使用。',
    nameLabel: '標題',
    namePlaceholder: '選填',
    collapseAll: '全部摺疊',
    expandAll: '全部展開'
  },

  episodes: {
    title: '分集',
    emptyTitle: '尚無分集',
    emptyHint: '掃描劇集目錄或刮取中繼資料後，分集會出現在這裡。',
    unnamed: ({ number }: { number: string }) => `第 ${number} 集`,
    code: ({ season, episode }: { season: number; episode: string }) =>
      `S${String(season).padStart(2, '0')}E${episode.padStart(2, '0')}`,
    entityLabel: '分集',
    watched: '已看',
    unwatched: '未看',
    stillEntityLabel: '劇照',
    resumeAt: ({ position }: { position: string }) => `從 ${position} 繼續`,
    markWatched: '標記為已看',
    markUnwatched: '標記為未看',
    watchedUpdated: '觀看狀態已更新。',
    progress: ({ watched, total }: { watched: number; total: number }) =>
      `已看 ${watched} / ${total}`,
    playCount: '播放次數',
    watchedAt: '觀看時間',
    resumeLabel: '續播位置',
    airDate: '播出日',

    catchUp: {
      title: '將其餘分集標記為已看？',
      pendingCount: ({ count }: { count: number }) => `還有 ${count} 集未標記為已看。`,
      pendingByType: {
        regular: ({ count }: { count: number }) => `${count} 集正片`,
        special: ({ count }: { count: number }) => `${count} 集特別篇`
      },
      hint: '標記只記錄觀看狀態，不記錄觀看時長。',
      markAll: '全部標記',
      markRegularOnly: '僅正片',
      skip: '略過',
      marked: ({ count }: { count: number }) => `已將 ${count} 集標記為已看。`
    },

    addEpisode: '新增分集',
    editEpisode: '編輯分集',
    deleteEpisode: '刪除分集',
    episodeDeleted: '分集已刪除。',
    numberLabel: '集號',
    numberPlaceholder: '選填',
    seasonLabel: '所屬季',
    durationMinutes: '時長（分鐘）',
    numberInvalid: '集號必須為正數。',
    durationInvalid: '時長必須為正數。',

    syncFiles: '同步檔案',
    syncCompleted: ({
      seasons,
      episodes,
      files,
      extras
    }: {
      seasons: number
      episodes: number
      files: number
      extras: number
    }) => `已同步 ${seasons} 季、${episodes} 集、${files} 個檔案與 ${extras} 個特典。`,
    syncFailed: '檔案同步失敗。',
    syncUnrecognized: ({ count }: { count: number }) => `${count} 個檔案無法辨識季集編號。`
  },

  extras: {
    title: '特典',
    emptyTitle: '尚無特典',
    emptyHint: '目錄中的預告片與幕後花絮會出現在這裡。',
    entityLabel: '特典',
    addExtra: '新增特典',
    extraAttached: '特典已新增',
    editTitle: '編輯特典',
    extraUpdated: '特典已更新',
    deleteExtra: '刪除特典',
    extraRemoved: '特典記錄已移除',
    play: '播放',
    playFailed: '播放特典失敗',
    stopFailed: '停止特典失敗',
    nameLabel: '名稱',
    typeLabel: '類型',
    autoDetect: '自動辨識'
  },

  files: {
    title: '檔案',
    playFile: '播放此檔案',
    missingFile: '無檔案',
    noFiles: '尚無檔案。',
    fileCount: ({ count }: { count: number }) => `${count} 個檔案`,
    primary: '主檔案',
    resolution: '解析度',
    codec: '編碼',
    audioTracks: '音軌',
    subtitleTracks: '字幕軌',
    audioTrackCount: ({ count }: { count: number }) => `${count} 條音軌`,
    subtitleTrackCount: ({ count }: { count: number }) => `${count} 條字幕軌`,
    openFolder: '開啟所在資料夾',
    openFolderFailed: '無法開啟所在資料夾。',
    setPrimary: '設為主檔案',
    primaryUpdated: '主檔案已更新。',
    removeFile: '移除檔案記錄',
    fileRemoved: '檔案記錄已移除。',
    recordEntityLabel: '檔案記錄',
    addFile: '新增檔案',
    fileAttached: '檔案已關聯。',
    attachFailed: '無法關聯該檔案。',
    manualBadge: '手動',
    noteLabel: '備註',
    editNote: '編輯備註',
    noteSaved: '備註已儲存。'
  },

  player: {
    pause: '暫停',
    resume: '繼續',
    pauseFailed: '無法暫停播放。',
    resumeFailed: '無法繼續播放。'
  },

  detail: {
    openTvDir: '開啟劇集目錄',
    tvDirNotSet: '尚未設定劇集目錄。',
    watchStatus: '觀看狀態'
  },

  filesConfig: {
    title: '檔案設定',
    tvDirLabel: '劇集目錄',
    tvDirPlaceholder: '未設定',
    selectDir: '選擇目錄',
    tvDirHint:
      '檔案同步會掃描該目錄，依 SxxEyy 編號比對分集檔案；留空則完全手動管理檔案。儲存變更會重新同步檔案。'
  },

  statusDialog: {
    title: '編輯觀看狀態',
    label: '觀看狀態',
    selectStatus: '選擇狀態'
  },

  lastActiveDialog: {
    title: '編輯最近觀看時間',
    label: '最近觀看時間',
    emptyHint: '留空表示從未觀看。'
  },

  duration: {
    title: '編輯觀看時長',
    totalTime: '總觀看時長',
    sessionsDuration: ({ value }: { value: string }) => `記錄時長：${value}`,
    untrackedDuration: ({ value }: { value: string }) => `未記錄：${value}`,
    untrackedLabel: '未記錄觀看時長',
    hoursUnit: '小時',
    minutesUnit: '分鐘',
    untrackedHint: '未被工作階段記錄涵蓋的觀看時長（例如匯入的歷史記錄）。',
    sessionsHeader: ({ count }: { count: number }) => `觀看記錄（${count}）`,
    emptySessions: '尚無觀看記錄，可在下方新增。',
    addRecord: '新增記錄',
    editRecord: '編輯記錄',
    startTime: '開始時間',
    endTime: '結束時間',
    startEndRequired: '請填寫開始與結束時間。',
    endAfterStart: '結束時間必須晚於開始時間。',
    overlap: '時間區間與既有記錄重疊。',
    recordAdded: '記錄已新增',
    recordUpdated: '記錄已更新',
    recordDeleted: '記錄已刪除',
    deleteRecordDescription: '刪除這筆觀看記錄？此操作無法復原。'
  },

  activity: {
    emptyTitle: '尚無觀看記錄',
    emptyHint: '開始觀看分集後，觀看時長會自動記錄在這裡。',
    statsOverview: '數據概覽',
    heatmap: '活躍熱力圖',
    trend: '觀看趨勢',
    distribution: '時段分布',
    recentSessions: '最近記錄',
    totalDuration: '觀看時長',
    sessionCount: '觀看次數',
    sessionCountValue: ({ count }: { count: number }) => `${count} 次`,
    avgDuration: '平均時長',
    longestSession: '最長單次',
    currentStreak: '目前連續',
    longestStreak: '最長連續',
    streakValue: ({ days }: { days: number }) => `${days} 天`,
    firstSession: '首次觀看',
    lastSession: '最近觀看',
    dayOfMonthLabel: ({ day }: { day: number }) => `${day} 日`
  }
} satisfies Messages['tv']
