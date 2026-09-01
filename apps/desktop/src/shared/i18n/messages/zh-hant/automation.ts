import type { Messages } from '../schema'

/** Automation: page, toolbar, rows, form dialog, details dialog, and run history. */
export const automation = {
  title: '自動化',
  addAutomation: '新增自動化',

  display: {
    onStartup: '啟動時',
    manualOnly: '手動執行',
    triggerSeparator: '，',
    systemTimezone: '系統時區',
    noRetry: '不重試',
    retryTimes: ({ count }: { count: number }) => `重試 ${count} 次`,
    pauseAfterFailure: '失敗後暫停',
    pauseAfterFailureWithRetry: ({ count }: { count: number }) => `失敗後暫停，先重試 ${count} 次`,
    never: '從未',
    statusCompleted: '完成',
    statusFailed: '失敗',
    triggerManual: '手動',
    triggerStartup: '啟動'
  },

  feedback: {
    notTriggered: '自動化未觸發',
    runCompleted: '自動化呼叫已完成',
    runFailed: '自動化呼叫失敗',
    runError: '執行自動化失敗',
    stopRequested: '已要求停止自動化重試',
    notRunning: '自動化未在執行',
    stopFailed: '停止自動化失敗',
    enabled: '自動化已啟用',
    disabled: '自動化已停用',
    updateFailed: '更新自動化失敗',
    deleted: '自動化已刪除',
    deleteFailed: '刪除自動化失敗',
    updated: '自動化已更新',
    added: '自動化已新增',
    saveFailed: '儲存自動化失敗',
    selectCommand: '請選擇命令'
  },

  page: {
    emptyDescription: '暫無自動化',
    noMatchDescription: '沒有符合的自動化',
    table: {
      name: '名稱',
      command: '命令',
      trigger: '觸發',
      run: '執行',
      status: '狀態',
      actions: '操作'
    },
    deleteTitle: '刪除自動化？',
    deleteDescription: ({ name }: { name: string }) => `確定要刪除「${name}」嗎？此操作無法復原。`,
    deleting: '刪除中'
  },

  row: {
    app: '應用程式',
    nextRun: ({ label }: { label: string }) => `下次 ${label}`,
    nextNone: '無',
    disabled: '已停用',
    running: '執行中',
    notInvoked: '未呼叫',
    stopRetry: '停止重試',
    run: '執行',
    details: '詳細資訊'
  },

  toolbar: {
    filterAll: '全部',
    filterEnabled: '已啟用',
    filterDisabled: '已停用',
    filterRunning: '執行中',
    filterFailed: '失敗',
    sortCreatedAt: '建立時間',
    sortName: '名稱',
    sortLastRunAt: '最近執行',
    sortNextRunAt: '下次執行',
    sourceAll: '全部來源',
    sourceApp: '應用程式',
    sourceExtension: '擴充功能',
    searchPlaceholder: '搜尋自動化…'
  },

  form: {
    addTitle: '新增自動化',
    editTitle: '編輯自動化',
    commandUnavailable: '命令目前無法使用',
    name: '名稱',
    namePlaceholder: '自動化名稱',
    command: '命令',
    trigger: '觸發',
    configure: '設定',
    failurePolicy: '失敗策略',
    policyNone: '不重試',
    policyRetry: '重試',
    policyPause: '失敗後暫停',
    retryCount: '重試次數',
    retryDelay: '重試延遲',
    seconds: '秒',
    params: '參數',
    configureTrigger: '設定觸發',
    runOnStartup: '啟動時執行',
    expression: '運算式',
    cronPlaceholder: 'Cron 運算式，留空則不啟用',
    timezone: '時區',
    timezonePlaceholder: '系統時區',
    paramsMustBeObject: '參數必須是 JSON 物件',
    cronRequired: 'Cron 運算式不能為空',
    retryCountLabel: '重試次數',
    retryDelaySecondsLabel: '重試延遲秒數',
    mustBePositive: ({ label }: { label: string }) => `${label}必須大於 0`,
    mustBeNonNegativeInteger: ({ label }: { label: string }) => `${label}必須是大於等於 0 的整數`,
    invalidTimezone: '時區無效'
  },

  details: {
    app: '應用程式',
    running: '執行中',
    command: '命令',
    source: '來源',
    trigger: '觸發',
    runTime: '執行時間',
    lastRun: ({ time }: { time: string }) => `最近 ${time}`,
    nextRun: ({ time }: { time: string }) => `下次 ${time}`,
    nextNone: '無',
    nextDisabled: '已停用',
    createdAt: '建立',
    updatedAt: '更新',
    params: '參數',
    history: '呼叫歷史',
    historyCount: ({ count }: { count: number }) => `${count} 筆`,
    noHistory: '暫無呼叫歷史',
    historyRun: '執行',
    historyTrigger: '觸發',
    historyStartedAt: '開始時間',
    historyDuration: '耗時',
    historyResult: '結果',
    viewFullResult: '檢視完整結果',
    runResult: '呼叫結果',
    runResultTitle: ({ title }: { title: string }) => `呼叫結果 ${title}`,
    attempt: '嘗試',
    startedAt: '開始',
    finishedAt: '結束',
    duration: '耗時',
    error: '錯誤',
    result: '結果',
    noError: '無錯誤'
  },

  combobox: {
    searchPlaceholder: '搜尋命令…',
    selectPlaceholder: '選擇命令…',
    unavailable: '命令目前無法使用'
  }
} satisfies Messages['automation']
