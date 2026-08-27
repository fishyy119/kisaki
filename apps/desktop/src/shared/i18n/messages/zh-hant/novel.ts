import type { Messages } from '@shared/i18n'

export const novel = {
  readStart: '開始閱讀',
  readContinue: '繼續閱讀',
  stop: '停止',
  volumes: {
    title: '卷',
    emptyTitle: '還沒有卷',
    emptyHint: '掃描小說資料夾或擷取中繼資料以產生卷清單',
    unnamed: ({ number }: { number: string }) => `第${number}卷`,
    entityLabel: '卷',
    read: '已讀',
    unread: '未讀',
    resumeProgress: ({ percent }: { percent: number }) => `從 ${percent}% 繼續`,
    markRead: '標記為已讀',
    markUnread: '標記為未讀',
    readUpdated: '閱讀狀態已更新',
    progress: ({ read, total }: { read: number; total: number }) => `已讀 ${read} / ${total}`,
    readCount: '閱讀次數',
    readAt: '讀完時間',
    releaseDate: '發行日期',

    catchUp: {
      title: '將剩餘卷標記為已讀？',
      pendingCount: ({ count }: { count: number }) => `${count} 卷尚未標記為已讀`,
      hint: '僅記錄閱讀狀態，不記錄閱讀時間',
      markAll: '全部標記',
      skip: '跳過',
      marked: ({ count }: { count: number }) => `已將 ${count} 卷標記為已讀`
    },

    addVolume: '新增卷',
    editVolume: '編輯卷',
    deleteVolume: '刪除卷',
    volumeDeleted: '卷已刪除',
    numberLabel: '卷號',
    numberPlaceholder: '選填',
    numberInvalid: '卷號必須為正數',
    numberRequired: '卷需要卷號或名稱',

    syncFiles: '同步檔案',
    syncCompleted: ({ volumes, files }: { volumes: number; files: number }) =>
      `已同步 ${volumes} 卷、${files} 個檔案`,
    syncFailed: '檔案同步失敗',
    syncUnrecognized: ({ count }: { count: number }) => `${count} 個檔案無法識別卷號`
  },

  files: {
    title: '檔案',
    readFile: '閱讀此檔案',
    missingFile: '無檔案',
    noFiles: '還沒有檔案',
    fileCount: ({ count }: { count: number }) => `${count} 個檔案`,
    primary: '主檔案',
    openFolder: '開啟所在資料夾',
    openFolderFailed: '無法開啟所在資料夾',
    setPrimary: '設為主檔案',
    primaryUpdated: '主檔案已更新',
    removeFile: '移除檔案記錄',
    fileRemoved: '檔案記錄已移除',
    recordEntityLabel: '檔案記錄',
    addFile: '新增檔案',
    fileAttached: '檔案已新增',
    attachFailed: '無法新增檔案',
    manualBadge: '手動',
    noteLabel: '備註',
    editNote: '編輯備註',
    noteSaved: '備註已儲存'
  },

  detail: {
    openNovelDir: '開啟小說資料夾',
    novelDirNotSet: '未設定小說資料夾',
    readStatus: '閱讀狀態'
  },

  filesConfig: {
    title: '檔案設定',
    novelDirLabel: '小說資料夾',
    novelDirPlaceholder: '未設定',
    selectDir: '選擇資料夾',
    novelDirHint:
      '檔案同步會掃描該資料夾以匹配卷檔案；留空則完全手動管理檔案。儲存修改後會重新同步檔案。'
  },

  statusDialog: {
    title: '編輯閱讀狀態',
    label: '閱讀狀態',
    selectStatus: '選擇狀態'
  },

  lastActiveDialog: {
    title: '編輯最後閱讀時間',
    label: '最後閱讀時間',
    emptyHint: '留空表示從未閱讀'
  },

  duration: {
    title: '編輯閱讀時長',
    totalTime: '總閱讀時長',
    sessionsDuration: ({ value }: { value: string }) => `工作階段：${value}`,
    untrackedDuration: ({ value }: { value: string }) => `未追蹤：${value}`,
    untrackedLabel: '未追蹤閱讀時長',
    hoursUnit: '小時',
    minutesUnit: '分鐘',
    untrackedHint: '未被工作階段涵蓋的閱讀時長（如匯入的歷史記錄）',
    sessionsHeader: ({ count }: { count: number }) => `工作階段（${count}）`,
    emptySessions: '還沒有工作階段記錄，在下方新增。',
    addRecord: '新增記錄',
    editRecord: '編輯記錄',
    startTime: '開始時間',
    endTime: '結束時間',
    startEndRequired: '請填寫開始和結束時間',
    endAfterStart: '結束時間必須晚於開始時間',
    overlap: '時間範圍與現有記錄重疊',
    recordAdded: '記錄已新增',
    recordUpdated: '記錄已更新',
    recordDeleted: '記錄已刪除',
    deleteRecordDescription: '刪除該工作階段記錄？此操作無法復原。'
  },

  activity: {
    emptyTitle: '還沒有閱讀活動',
    emptyHint: '開始閱讀卷後會自動記錄閱讀時長',
    statsOverview: '統計概覽',
    heatmap: '活動熱力圖',
    trend: '閱讀趨勢',
    distribution: '時段分佈',
    recentSessions: '最近工作階段',
    totalDuration: '閱讀時長',
    sessionCount: '工作階段數',
    sessionCountValue: ({ count }: { count: number }) => `${count} 次工作階段`,
    avgDuration: '平均工作階段',
    longestSession: '最長工作階段',
    currentStreak: '目前連續',
    longestStreak: '最長連續',
    streakValue: ({ days }: { days: number }) => `${days} 天`,
    firstSession: '首次閱讀',
    lastSession: '最後閱讀',
    dayOfMonthLabel: ({ day }: { day: number }) => `${day} 日`
  }
} satisfies Messages['novel']
