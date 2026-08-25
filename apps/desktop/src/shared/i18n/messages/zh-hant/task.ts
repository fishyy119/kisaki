import type { Messages } from '../schema'

/** Task center: run list, controls, details, and task-run display vocabulary. */
export const task = {
  center: '任務中心',
  tabActive: '進行中',
  tabCompleted: '已完成',
  noActiveTasks: '暫無進行中的任務',
  noCompletedRecords: '暫無完成紀錄',

  table: {
    task: '任務',
    progress: '進度',
    result: '結果',
    status: '狀態',
    actions: '操作'
  },

  toolbar: {
    searchActivePlaceholder: '搜尋進行中的任務…',
    searchCompletedPlaceholder: '搜尋完成紀錄…',
    refreshing: '重新整理中…',
    allCategories: '全部分類',
    allStatuses: '全部狀態',
    refresh: '重新整理',
    refreshList: '重新整理任務清單',
    clearCompleted: '清理完成紀錄'
  },

  feedback: {
    refreshFailed: '重新整理任務中心失敗',
    clearFailed: '清理任務紀錄失敗',
    deleteFailed: '刪除任務紀錄失敗',
    pauseFailed: '暫停任務失敗',
    resumeFailed: '繼續任務失敗',
    cancelFailed: '取消任務失敗',
    cannotPauseNow: '任務暫時無法暫停',
    cannotResumeNow: '任務暫時無法繼續',
    cannotCancel: '任務已結束或無法取消'
  },

  row: {
    pause: '暫停',
    pauseTask: '暫停任務',
    resume: '繼續',
    resumeTask: '繼續任務',
    cancel: '取消',
    cancelTask: '取消任務',
    details: '詳細資訊',
    viewDetails: '檢視詳細資訊',
    deleteRecord: '刪除紀錄',
    duration: '耗時',
    counters: '計數',
    warningCount: ({ count }: { count: number }) => `${count} 則警告`,
    moreWarnings: ({ count }: { count: number }) => `還有 ${count} 則警告`
  },

  progress: {
    progress: '進度',
    rate: '速度',
    eta: '剩餘',
    inProgress: '進行中',
    etaAbout: ({ duration }: { duration: string }) => `約 ${duration}`
  },

  details: {
    runId: '任務 ID',
    category: '分類',
    operation: '操作',
    operationId: '操作 ID',
    owner: '來源',
    initiator: '發起',
    subject: '對象',
    createdAt: '建立',
    startedAt: '開始',
    finishedAt: '結束',
    duration: '耗時',
    warnings: '警告',
    info: '資訊',
    description: '描述',
    result: '結果',
    output: '輸出',
    noResultSummary: '無結果摘要'
  },

  categories: {
    scanner: '掃描',
    ingest: '匯入',
    extension: '擴充功能',
    updater: '更新',
    system: '系統'
  },

  statuses: {
    queued: '排隊中',
    running: '執行中',
    pausing: '暫停中',
    paused: '已暫停',
    cancelling: '取消中',
    completed: '已完成',
    failed: '失敗',
    cancelled: '已取消'
  },

  counters: {
    total: '總數',
    processed: '已處理',
    succeeded: '成功',
    failed: '失敗',
    skipped: '略過',
    warnings: '警告',
    added: '新增',
    existing: '已存在',
    updated: '更新',
    deleted: '刪除',
    changed: '變化',
    notModified: '未變化'
  },

  subjects: {
    command: '命令',
    automation: '自動化',
    scanner: '掃描器',
    game: '遊戲',
    anime: '動漫',
    comic: '漫畫',
    novel: '小說',
    person: '人物',
    company: '公司',
    character: '角色',
    extension: '擴充功能',
    repository: '儲存庫',
    app: '應用程式'
  },
  subjectValue: ({ label, value }: { label: string; value: string }) => `${label}：${value}`,

  operations: {
    scan: '掃描媒體',
    installExtension: '安裝擴充功能',
    updateExtension: '更新擴充功能',
    importExtensionPackage: '匯入擴充功能套件',
    uninstallExtension: '解除安裝擴充功能',
    refreshRepository: '重新整理擴充功能儲存庫',
    refreshAllRepositories: '重新整理全部擴充功能儲存庫',
    checkUpdates: '檢查軟體更新',
    downloadUpdate: '下載軟體更新',
    systemMaintenance: '系統維護',
    extensionTask: '擴充功能任務',
    ingestAdd: ({ label }: { label: string }) => `新增${label}`,
    ingestUpdate: ({ label }: { label: string }) => `更新${label}`,
    ingestBatchAdd: ({ label }: { label: string }) => `批次新增${label}`,
    ingestBatchUpdate: ({ label }: { label: string }) => `批次更新${label}`,
    ingestBatchDelete: ({ label }: { label: string }) => `批次刪除${label}`,
    ingestFallbackEntity: '條目'
  },

  owner: {
    app: '應用程式',
    extension: ({ name }: { name: string }) => `擴充功能：${name}`
  },

  initiator: {
    user: '使用者',
    automation: ({ name }: { name: string }) => `自動化：${name}`,
    extension: ({ name }: { name: string }) => `擴充功能：${name}`,
    system: '系統',
    systemWithReason: ({ reason }: { reason: string }) => `系統：${reason}`
  },

  systemReasons: {
    startup: '啟動',
    maintenance: '維護',
    update: '更新',
    shutdown: '結束',
    watch: '檔案變更'
  },

  progressUnits: {
    item: '項',
    file: '檔案',
    byte: '位元組',
    entity: '項',
    step: '步驟',
    package: '套件',
    request: '請求'
  },

  ratePeriods: {
    second: '秒',
    minute: '分鐘',
    hour: '小時'
  },

  notifications: {
    cancelling: '正在取消…',
    pausing: '正在暫停…',
    paused: '已暫停',
    cancelUnavailable: '任務已結束或不可取消',
    finalCompleted: ({ title }: { title: string }) => `${title}已完成`,
    finalCancelled: ({ title }: { title: string }) => `${title}已取消`,
    finalFailed: ({ title }: { title: string }) => `${title}失敗`
  }
} satisfies Messages['task']
