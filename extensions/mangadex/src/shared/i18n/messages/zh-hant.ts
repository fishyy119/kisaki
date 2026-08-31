import type { MangadexMessages } from '../index'

export const zhHant: MangadexMessages = {
  errors: {
    authRequired: '請先儲存 MangaDex 個人用戶端憑證',
    authFailed: 'MangaDex 拒絕了憑證，請檢查四項內容是否正確。',
    notFound: '該 MangaDex 條目不存在',
    rateLimited: '對 MangaDex 的請求過於頻繁，請稍後重試。',
    rejected: 'MangaDex API 拒絕了請求',
    unavailable: 'MangaDex API 暫時無法使用',
    networkFailed: '對 MangaDex 的網路請求失敗',
    operationCancelled: '操作已取消',
    idInvalid: ({ value }) => `「${value}」不是有效的 MangaDex ID`,
    credentialsIncomplete: '請填寫全部四項憑證',
    operationRunning: '已有 MangaDex 清單操作正在執行，請等待其完成。'
  },

  sync: {
    autoSyncFailedTitle: 'MangaDex 同步失敗',
    autoSyncFailedFallback: '無法將變更推送到 MangaDex',
    pushTaskTitle: '將媒體庫推送到 MangaDex',
    pushSummary: ({ pushed, skipped, failed }) =>
      `已推送 ${pushed} 項、跳過 ${skipped} 項、失敗 ${failed} 項`
  },

  import: {
    taskTitle: '匯入 MangaDex 閱讀狀態',
    phaseRead: '正在讀取 MangaDex 狀態',
    phaseApply: '正在套用條目',
    itemFailed: ({ id }) => `${id} 匯入失敗`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `新建 ${created} 項、更新 ${updated} 項、無變化 ${unchanged} 項、跳過 ${skipped} 項、失敗 ${failed} 項`
  },

  commands: {
    verifyAccount: {
      title: '驗證 MangaDex 帳號',
      description: '向 MangaDex 介面驗證已儲存的憑證'
    },
    pushAll: {
      title: '推送資料庫到 MangaDex',
      description: '將所有帶 MangaDex ID 的條目推送到帳號'
    },
    importStatuses: {
      title: '匯入 MangaDex 閱讀狀態',
      description: '將閱讀狀態與評分寫入相符的本機條目'
    }
  },

  automations: {
    names: {
      'auth-check': 'MangaDex：啟動時驗證帳號',
      'push-full-daily': 'MangaDex：每日全量推送',
      'import-refresh-weekly': 'MangaDex：每週狀態重新整理'
    },
    labels: {
      'auth-check': '啟動時驗證帳號',
      'push-full-daily': '每日全量推送',
      'import-refresh-weekly': '每週狀態重新整理'
    },
    descriptions: {
      'auth-check': '應用啟動時驗證 MangaDex 憑證',
      'push-full-daily': '每天凌晨將全部已關聯條目推送到 MangaDex 帳號',
      'import-refresh-weekly': '每週將閱讀狀態與評分重新匯入到既有條目'
    },
    status: {
      missing: '未建立',
      enabled: '已啟用',
      disabled: '已停用'
    }
  },

  settings: {
    webviewTitle: 'MangaDex',
    commandLabel: '設定',
    commandDescription: '連接 MangaDex 帳號、匯入閱讀狀態並設定刮削'
  },

  ui: {
    loading: '載入中…',
    unavailable: '無法載入 MangaDex 設定',
    saved: '設定已儲存',
    savePreferences: '儲存',
    discardChanges: '放棄',
    unsavedChanges: '有未儲存的變更',
    actionFailed: '操作失敗',
    cancel: '取消',
    confirm: '確認',

    tabs: {
      overview: '概覽',
      account: '帳號',
      sync: '同步',
      import: '匯入',
      automation: '自動化',
      maintenance: '維護'
    },

    task: {
      progress: ({ current, total }) => `${current} / ${total}`,
      running: '進行中',
      completed: '已完成',
      failed: '失敗',
      cancelled: '已取消',
      cancel: '取消'
    },

    overview: {
      statusTitle: '狀態總覽',
      accountLabel: '帳號',
      connected: '已連接',
      notConnected: '未連接',
      available: '可用',
      autoSyncLabel: '自動推送',
      enabled: '已啟用',
      disabled: '已停用',
      withScore: '狀態與評分',
      withoutScore: '僅狀態',
      recommendedAutomations: '推薦自動化',
      automationsComplete: '已全部建立',
      automationsMissing: ({ count }) => `${count} 項未建立`,
      templatesCount: ({ count }) => `${count} 個範本`,
      runtimeTitle: '執行狀態',
      runningJobs: '執行中的 MangaDex 任務',
      running: '執行中',
      idle: '閒置',
      quickActionsTitle: '快捷入口',
      importAction: '匯入 MangaDex 閱讀狀態',
      maintenanceAction: '調整介面與用戶端選項',
      automationsTitle: '自動化範本'
    },

    account: {
      title: '帳號',
      description:
        'MangaDex 個人工具透過個人 API 用戶端登入。請在 MangaDex 設定中建立一個，然後填寫其 ID 與金鑰，以及帳號使用者名稱和密碼；全部內容僅儲存在本機金鑰庫。',
      statusLabel: '狀態',
      configuredLabel: '已連接',
      missingLabel: '未連接',
      clientIdLabel: '用戶端 ID',
      clientSecretLabel: '用戶端金鑰',
      usernameLabel: '使用者名稱',
      passwordLabel: '密碼',
      save: '連接帳號',
      clear: '中斷連接',
      verify: '驗證帳號',
      verifiedAs: ({ userName }) => `已以 ${userName} 的身分連接`,
      openClientSettings: '開啟 MangaDex API 用戶端頁面'
    },

    sync: {
      preferencesTitle: '自動推送偏好',
      syncEnabledLabel: '自動推送變更',
      syncEnabledDescription: '將帶有 MangaDex ID 條目的狀態與評分變更推送到帳號',
      pushScoreLabel: '包含評分',
      pushScoreDescription: '將本機評分寫入 MangaDex 評分。本機評分為空時不會清除遠端評分。',
      manualTitle: '手動推送',
      manualDescription: '將所有帶 MangaDex ID 的條目推送到帳號。進度與取消由任務中心接管。',
      pushAll: '立即全量推送'
    },

    import: {
      title: '匯入閱讀狀態',
      description: '將閱讀狀態寫入相符的條目。建立缺漏條目時會經所選設定檔刮削完整中繼資料。',
      optionsLabel: '選項',
      importScoresLabel: '同時匯入評分',
      updateExistingLabel: '更新既有條目',
      createMissingLabel: '建立缺漏條目',
      profileLabel: '漫畫設定檔',
      profilePlaceholder: '選擇設定檔',
      runLabel: '執行匯入',
      runDescription: '以應用任務執行；以上選項僅作用於本次執行',
      startImport: '匯入'
    },

    automation: {
      title: '推薦自動化',
      description: '此處僅建立推薦的 MangaDex 範本；啟用狀態、觸發器與歷史在應用的自動化頁面管理',
      create: '建立'
    },

    maintenance: {
      endpointTitle: '介面位址',
      endpointDescription: '當官方位址無法連線時，可指向鏡像',
      apiUrlLabel: 'API 位址',
      apiUrlDescription: 'MangaDex REST API 的根位址；登入流量仍走官方位址',
      restoreDefaults: '還原官方位址',
      clientTitle: '刮削與用戶端',
      clientDescription: '套用於所有 MangaDex 搜尋與刮削',
      preferRomanizedLabel: '優先羅馬字標題',
      preferRomanizedDescription: '當沒有符合內容語言的標題時，使用羅馬字標題作為顯示名稱',
      timeoutLabel: '請求逾時',
      timeoutDescription: '等待單次回應的秒數',
      seconds: '秒',
      retryLabel: '重試次數',
      retryDescription: '限流或伺服器錯誤後的額外嘗試次數',
      retryUnit: '次',
      actionsTitle: '維護操作',
      actionsDescription: '這些操作立即生效且無法復原',
      reset: '還原預設設定',
      resetDescription: '偏好將還原為預設值，已儲存的憑證保留。'
    }
  }
}
