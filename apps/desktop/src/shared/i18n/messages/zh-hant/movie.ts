import type { Messages } from '../schema'

export const movie = {
  watchStart: '觀看',
  watchContinue: '繼續觀看',
  watchAgain: '重看',
  stop: '停止',
  showDetail: '查看詳情',

  watch: {
    watched: '已看',
    unwatched: '未看',
    markWatched: '標記為已看',
    markUnwatched: '標記為未看',
    watchedUpdated: '觀看狀態已更新。',
    resumeAt: ({ position }: { position: string }) => `從 ${position} 繼續`,
    clearResume: '清除續播位置',
    resumeCleared: '續播位置已清除。',
    playCount: '播放次數',
    watchedAt: '觀看時間',
    resumeLabel: '續播位置',
    runtime: '片長'
  },

  extras: {
    title: '特典',
    emptyTitle: '尚無特典',
    emptyHint: '目錄中的預告片與刪減片段會出現在這裡。',
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
    title: '版本',
    emptyTitle: '尚無檔案',
    emptyHint: '掃描電影目錄或新增檔案後即可播放。',
    playFile: '播放此檔案',
    missingFile: '無檔案',
    noFiles: '尚無檔案。',
    fileCount: ({ count }: { count: number }) => `${count} 個檔案`,
    primary: '主檔案',
    editionLabel: '版本',
    editionPlaceholder: '劇場版、導演剪輯版……',
    editionSaved: '版本已儲存。',
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
    noteSaved: '備註已儲存。',

    syncFiles: '同步檔案',
    syncCompleted: ({ files, extras }: { files: number; extras: number }) =>
      `已同步 ${files} 個檔案與 ${extras} 個特典。`,
    syncFailed: '檔案同步失敗。'
  },

  player: {
    pause: '暫停',
    resume: '繼續',
    pauseFailed: '無法暫停播放。',
    resumeFailed: '無法繼續播放。'
  },

  detail: {
    openMovieDir: '開啟電影目錄',
    movieDirNotSet: '尚未設定電影目錄。',
    watchStatus: '觀看狀態'
  },

  filesConfig: {
    title: '檔案設定',
    movieDirLabel: '電影目錄',
    movieDirPlaceholder: '未設定',
    selectDir: '選擇目錄',
    movieDirHint:
      '檔案同步會掃描該目錄中的正片版本與特典；留空則完全手動管理檔案。儲存變更會重新同步檔案。'
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
    emptyHint: '開始觀看後，觀看時長會自動記錄在這裡。',
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
} satisfies Messages['movie']
