import type { Messages } from '../schema'

export const anime = {
  watchStart: '開始觀看',
  watchContinue: '繼續觀看',
  watchNext: '看下一集',
  stop: '停止',
  starting: '啟動中',
  playing: '播放中',

  episodes: {
    title: '劇集',
    emptyTitle: '尚無劇集',
    emptyHint: '掃描動漫資料夾或抓取中繼資料後，劇集會出現在這裡。',
    unnamed: ({ number }: { number: string }) => `第 ${number} 話`,
    entityLabel: '劇集',
    watched: '已看',
    unwatched: '未看',
    missingFile: '缺少檔案',
    fileCount: ({ count }: { count: number }) => `${count} 個檔案`,
    resumeAt: ({ position }: { position: string }) => `從 ${position} 繼續`,
    markWatched: '標記為已看',
    markUnwatched: '標記為未看',
    watchedUpdated: '觀看狀態已更新。',
    progress: ({ watched, total }: { watched: number; total: number }) =>
      `已看 ${watched} / ${total}`,
    showDetail: '檢視詳情',
    playCount: '播放次數',
    watchedAt: '觀看時間',
    resumeLabel: '續播位置',
    airDate: '放送日',

    addEpisode: '新增劇集',
    editEpisode: '編輯劇集',
    deleteEpisode: '刪除劇集',
    episodeDeleted: '劇集已刪除。',
    numberLabel: '集數',
    numberPlaceholder: '可留空',
    typeLabel: '類型',
    durationMinutes: '時長（分鐘）',
    numberInvalid: '集數必須為正數。',
    durationInvalid: '時長必須為正數。',

    syncFiles: '同步檔案',
    syncCompleted: ({
      episodes,
      files,
      extras
    }: {
      episodes: number
      files: number
      extras: number
    }) => `已同步 ${episodes} 個劇集、${files} 個檔案、${extras} 個特典。`,
    syncFailed: '檔案同步失敗。',
    syncUnrecognized: ({ count }: { count: number }) => `${count} 個檔案無法識別集數。`
  },

  extras: {
    title: '特典',
    emptyTitle: '尚無特典',
    emptyHint: '資料夾中的預告片、無字 OP/ED 會出現在這裡。',
    entityLabel: '特典',
    addExtra: '新增特典',
    extraAttached: '特典已新增',
    editTitle: '編輯特典',
    extraUpdated: '特典已更新',
    deleteExtra: '刪除特典',
    extraRemoved: '特典紀錄已刪除',
    play: '播放',
    playFailed: '播放特典失敗',
    nameLabel: '名稱',
    kindLabel: '類型',
    autoDetect: '自動識別'
  },

  files: {
    title: '檔案',
    primary: '首選',
    resolution: '解析度',
    codec: '編碼',
    audioTracks: '音軌',
    subtitleTracks: '字幕軌',
    audioTrackCount: ({ count }: { count: number }) => `${count} 音軌`,
    subtitleTrackCount: ({ count }: { count: number }) => `${count} 字幕軌`,
    openFolder: '開啟所在資料夾',
    openFolderFailed: '無法開啟所在資料夾。',
    setPrimary: '設為首選',
    primaryUpdated: '首選檔案已更新。',
    removeFile: '移除檔案記錄',
    fileRemoved: '檔案記錄已移除。',
    recordEntityLabel: '檔案記錄',
    addFile: '新增檔案',
    fileAttached: '檔案已新增。',
    attachFailed: '新增檔案失敗。',
    manualBadge: '手動'
  },

  player: {
    pause: '暫停',
    resume: '繼續播放',
    paused: '已暫停',
    pauseFailed: '無法暫停播放。',
    resumeFailed: '無法繼續播放。'
  },

  detail: {
    openAnimeDir: '開啟動漫資料夾',
    animeDirNotSet: '尚未設定動漫資料夾。',
    watchStatus: '觀看狀態'
  },

  filesConfig: {
    title: '檔案配置',
    animeDirLabel: '動漫資料夾',
    animeDirPlaceholder: '未設定',
    selectDir: '選擇資料夾',
    animeDirHint: '同步會掃描此資料夾來匹配劇集檔案；留空則完全手動管理檔案。儲存修改後會自動重新同步。',
    offsetLabel: '檔案集數偏移',
    offsetHint: '檔案集數 − 偏移 = 中繼資料集數，用於對齊絕對集數命名的檔案。',
    offsetInvalid: '偏移必須為整數。'
  },

  statusDialog: {
    title: '編輯觀看狀態',
    selectStatus: '選擇狀態'
  },

  lastActiveDialog: {
    title: '編輯最近觀看時間',
    label: '最近觀看時間',
    emptyHint: '留空表示從未觀看過。'
  },

  duration: {
    title: '編輯觀看時間',
    totalWatchTime: '總觀看時間',
    sessionsDuration: ({ value }: { value: string }) => `工作階段記錄：${value}`,
    untrackedDuration: ({ value }: { value: string }) => `未記錄時間：${value}`,
    untrackedLabel: '未記錄的觀看時間',
    hoursUnit: '小時',
    minutesUnit: '分鐘',
    untrackedHint: '觀看工作階段未記錄的觀看時間（如匯入的歷史資料）。',
    sessionsHeader: ({ count }: { count: number }) => `工作階段記錄（${count}）`,
    emptySessions: '尚無工作階段記錄，點擊下方按鈕新增',
    addRecord: '新增記錄',
    editRecord: '編輯記錄',
    startTime: '開始時間',
    endTime: '結束時間',
    startEndRequired: '請填寫開始和結束時間',
    endAfterStart: '結束時間必須晚於開始時間',
    overlap: '時間段與現有記錄重疊，請調整時間',
    recordAdded: '已新增記錄',
    recordUpdated: '已更新記錄',
    recordDeleted: '已刪除記錄',
    deleteRecordDescription: '確定要刪除這條工作階段記錄嗎？此操作無法復原。'
  },

  activity: {
    emptyTitle: '尚無觀看記錄',
    emptyHint: '開始播放劇集後，觀看時長會自動記錄在這裡。',
    statsOverview: '統計概覽',
    heatmap: '活動熱力圖',
    trend: '觀看趨勢',
    distribution: '時段分佈',
    recentSessions: '最近觀看',
    watchDuration: '觀看時長',
    sessionCount: '觀看次數',
    sessionCountValue: ({ count }: { count: number }) => `${count} 次`,
    avgDuration: '平均單次',
    longestSession: '最長單次',
    currentStreak: '目前連續',
    longestStreak: '最長連續',
    streakValue: ({ days }: { days: number }) => `${days} 天`,
    firstWatched: '首次觀看',
    lastWatched: '最近觀看',
    dayOfMonthLabel: ({ day }: { day: number }) => `${day}日`
  }
} satisfies Messages['anime']
