import type { AnilistMessages } from '../index'

export const zhHant: AnilistMessages = {
  errors: {
    authRequired: '請先登入你的 AniList 帳號',
    tokenExpired: 'AniList 登入已過期，請重新登入',
    notFound: '該 AniList 條目不存在',
    rateLimited: 'AniList 請求過於頻繁，請稍後再試',
    rejected: 'AniList 介面拒絕了該請求',
    unavailable: 'AniList 介面暫時無法使用',
    networkFailed: 'AniList 介面網路請求失敗',
    operationCancelled: '操作已取消',
    baseUrlInvalid: '請輸入 http 或 https 位址',
    idInvalid: ({ value }) => `「${value}」不是有效的 AniList ID`,
    relayUnavailable: 'Kisaki OAuth 中繼暫時無法使用，請稍後再試',
    loginSessionExpired: 'AniList 登入工作階段已過期，請重新登入',
    loginCallbackInvalid: 'AniList 登入回呼驗證失敗，請重新登入',
    noPendingLogin: '沒有等待完成的 AniList 登入',
    loginNotReady: 'AniList 登入尚未就緒',
    operationRunning: '已有 AniList 清單操作在執行，請等待其完成'
  },

  oauth: {
    loginSucceededTitle: 'AniList 登入完成',
    loginFailedTitle: 'AniList 登入失敗',
    loginCompleted: ({ userName }) => `已登入為 ${userName}`,
    callbackFailed: 'AniList 登入未能完成'
  },

  auth: {
    expiresSoonTitle: 'AniList 登入即將過期',
    expiresSoon: ({ days }) =>
      days > 0 ? `AniList 權杖將在 ${days} 天後過期，請重新登入以續期` : 'AniList 權杖已過期，請重新登入'
  },

  sync: {
    autoSyncFailedTitle: 'AniList 同步失敗',
    autoSyncFailedFallback: '該變更未能推送到 AniList',
    pushTaskTitle: '推送資料庫到 AniList 清單',
    pushSummary: ({ pushed, skipped, failed }) =>
      `已推送 ${pushed}，跳過 ${skipped}，失敗 ${failed}`
  },

  import: {
    taskTitle: '匯入 AniList 清單',
    phaseRead: '正在讀取 AniList 清單',
    phaseApply: '正在套用清單條目',
    itemFailed: ({ id }) => `匯入 ${id} 失敗`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `新建 ${created}，更新 ${updated}，無變化 ${unchanged}，跳過 ${skipped}，失敗 ${failed}`
  },

  commands: {
    verifyAccount: {
      title: '驗證 AniList 帳號',
      description: '向 AniList 介面驗證已儲存的登入，並在臨近過期時提醒'
    },
    pushAll: {
      title: '推送資料庫到 AniList',
      description: '將所有帶 AniList ID 的條目推送到清單'
    },
    importLists: {
      title: '匯入 AniList 清單',
      description: '將清單狀態與評分寫入相符的本機條目'
    }
  },

  automations: {
    names: {
      'auth-check': 'AniList：啟動時驗證帳號',
      'push-full-daily': 'AniList：每日全量推送',
      'import-refresh-weekly': 'AniList：每週清單重新整理'
    },
    labels: {
      'auth-check': '啟動時驗證帳號',
      'push-full-daily': '每日全量推送',
      'import-refresh-weekly': '每週清單重新整理'
    },
    descriptions: {
      'auth-check': '應用啟動時驗證 AniList 登入，並在權杖臨近過期時提醒',
      'push-full-daily': '每天凌晨將全部已關聯條目推送到 AniList 清單',
      'import-refresh-weekly': '每週將清單狀態與評分重新匯入到既有條目'
    },
    status: {
      missing: '未建立',
      enabled: '已啟用',
      disabled: '已停用'
    }
  },

  settings: {
    webviewTitle: 'AniList',
    commandLabel: '設定',
    commandDescription: '登入 AniList、匯入你的清單並設定刮削偏好'
  },

  ui: {
    loading: '載入中…',
    unavailable: '無法載入 AniList 設定',
    saved: '偏好已儲存',
    savePreferences: '儲存',
    discardChanges: '放棄變更',
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
      running: '執行中',
      completed: '已完成',
      failed: '已失敗',
      cancelled: '已取消',
      cancel: '取消'
    },

    overview: {
      statusTitle: '狀態總覽',
      accountLabel: '帳號',
      signedIn: '已登入',
      notSignedIn: '未登入',
      available: '可用',
      expiresSoon: '即將過期',
      expired: '已過期',
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
      runningJobs: '執行中的 AniList 任務',
      running: '執行中',
      idle: '閒置',
      quickActionsTitle: '快捷入口',
      importAction: '匯入 AniList 清單',
      maintenanceAction: '調整介面與用戶端選項',
      automationsTitle: '自動化範本'
    },

    account: {
      title: '帳號',
      description: '透過瀏覽器登入以連接你的 AniList 清單。權杖約一年有效，且無法續期。',
      statusLabel: '狀態',
      configuredLabel: '已登入',
      missingLabel: '未登入',
      pendingLabel: '等待瀏覽器登入…',
      expiresAtLabel: '權杖有效期至',
      expiredLabel: '已過期',
      login: '使用 AniList 登入',
      completeLogin: '我已完成授權',
      cancelLogin: '取消登入',
      logout: '登出',
      verify: '驗證帳號',
      verifiedAs: ({ userName }) => `已登入為 ${userName}`
    },

    sync: {
      preferencesTitle: '自動推送偏好',
      syncEnabledLabel: '自動推送變更',
      syncEnabledDescription: '帶 AniList ID 的條目的狀態與評分修改會推送到你的清單',
      pushScoreLabel: '包含評分',
      pushScoreDescription: '將本機評分寫入 AniList；本機評分為空時不會清除遠端評分',
      manualTitle: '手動推送',
      manualDescription: '將所有帶 AniList ID 的條目推送到清單。進度與取消由任務中心接管。',
      pushAll: '立即全量推送'
    },

    import: {
      title: '匯入清單',
      description: '將清單狀態與評分寫入相符的條目。新建缺失條目時透過所選設定檔刮削。',
      optionsLabel: '選項',
      listAnime: '動畫清單',
      listManga: '漫畫清單',
      updateExistingLabel: '更新既有條目',
      createMissingLabel: '新建缺失條目',
      animeProfileLabel: '動畫設定檔',
      comicProfileLabel: '漫畫設定檔',
      novelProfileLabel: '小說設定檔',
      profilePlaceholder: '選擇設定檔',
      runLabel: '執行匯入',
      runDescription: '以應用任務執行；以上選項僅作用於本次執行',
      startImport: '匯入'
    },

    automation: {
      title: '推薦自動化',
      description: '此處僅建立推薦的 AniList 範本；啟用狀態、觸發器與歷史在應用的自動化頁面管理',
      create: '建立'
    },

    maintenance: {
      endpointTitle: '介面位址',
      endpointDescription: '當官方位址無法連線時，可指向鏡像',
      graphqlUrlLabel: 'GraphQL 位址',
      graphqlUrlDescription: 'AniList GraphQL 介面的根位址',
      restoreDefaults: '還原官方位址',
      clientTitle: '刮削與用戶端',
      clientDescription: '套用於全部 AniList 搜尋與刮削',
      preferRomajiLabel: '優先使用羅馬字標題',
      preferRomajiDescription: '當內容語言沒有對應標題時，使用羅馬字標題作為顯示名稱',
      timeoutLabel: '請求逾時',
      timeoutDescription: '等待單次 AniList 回應的秒數',
      seconds: '秒',
      retryLabel: '重試次數',
      retryDescription: '遇到限流或伺服器錯誤後的額外嘗試次數',
      retryUnit: '次',
      actionsTitle: '維護操作',
      actionsDescription: '這些操作立即生效且無法復原',
      reset: '還原預設設定',
      resetDescription: '位址與偏好還原預設，登入保留'
    }
  }
}
