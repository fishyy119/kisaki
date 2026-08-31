import type { MalMessages } from '../index'

export const zhHant: MalMessages = {
  errors: {
    authRequired: '請先登入 MyAnimeList 帳號',
    tokenExpired: 'MyAnimeList 登入已過期，請重新登入。',
    notFound: '該 MyAnimeList 條目不存在',
    rateLimited: '對 MyAnimeList 的請求過於頻繁，請稍後重試。',
    rejected: 'MyAnimeList API 拒絕了請求',
    unavailable: 'MyAnimeList API 暫時無法使用',
    networkFailed: '對 MyAnimeList 的網路請求失敗',
    mirrorUnavailable: '中繼資料鏡像暫時無法使用',
    operationCancelled: '操作已取消',
    baseUrlInvalid: '請輸入 http 或 https 位址',
    idInvalid: ({ value }) => `「${value}」不是有效的 MyAnimeList ID`,
    loginStateMismatch: 'MyAnimeList 登入回呼驗證失敗，請重新登入。',
    loginDenied: 'MyAnimeList 授權已被拒絕，請重新登入。',
    loginAuthorizeFailed: 'MyAnimeList 回傳了授權錯誤，請重新登入。',
    loginSessionExpired: 'MyAnimeList 登入工作階段已過期，請重新登入。',
    noPendingLogin: '沒有等待完成的 MyAnimeList 登入',
    loginNotReady: 'MyAnimeList 登入尚未就緒',
    operationRunning: '已有 MyAnimeList 清單操作正在執行，請等待其完成。'
  },

  oauth: {
    loginSucceededTitle: 'MyAnimeList 登入成功',
    loginFailedTitle: 'MyAnimeList 登入失敗',
    loginCompleted: ({ userName }) => `已以 ${userName} 的身分登入`,
    callbackFailed: '無法完成 MyAnimeList 登入'
  },

  sync: {
    autoSyncFailedTitle: 'MyAnimeList 同步失敗',
    autoSyncFailedFallback: '無法將變更推送到 MyAnimeList',
    pushTaskTitle: '將媒體庫推送到 MyAnimeList 清單',
    pushSummary: ({ pushed, skipped, failed }) =>
      `已推送 ${pushed} 項、跳過 ${skipped} 項、失敗 ${failed} 項`
  },

  import: {
    taskTitle: '匯入 MyAnimeList 清單',
    phaseRead: '正在讀取 MyAnimeList 清單',
    phaseApply: '正在套用清單條目',
    itemFailed: ({ id }) => `${id} 匯入失敗`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `新建 ${created} 項、更新 ${updated} 項、無變化 ${unchanged} 項、跳過 ${skipped} 項、失敗 ${failed} 項`
  },

  commands: {
    verifyAccount: {
      title: '驗證 MyAnimeList 帳號',
      description: '向 MyAnimeList 介面驗證已儲存的登入'
    },
    pushAll: {
      title: '推送資料庫到 MyAnimeList',
      description: '將所有帶 MyAnimeList ID 的條目推送到清單'
    },
    importLists: {
      title: '匯入 MyAnimeList 清單',
      description: '將清單狀態與評分寫入相符的本機條目'
    }
  },

  automations: {
    names: {
      'auth-check': 'MyAnimeList：啟動時驗證帳號',
      'push-full-daily': 'MyAnimeList：每日全量推送',
      'import-refresh-weekly': 'MyAnimeList：每週清單重新整理'
    },
    labels: {
      'auth-check': '啟動時驗證帳號',
      'push-full-daily': '每日全量推送',
      'import-refresh-weekly': '每週清單重新整理'
    },
    descriptions: {
      'auth-check': '應用啟動時驗證 MyAnimeList 登入，並保持權杖自動重新整理',
      'push-full-daily': '每天凌晨將全部已關聯條目推送到 MyAnimeList 清單',
      'import-refresh-weekly': '每週將清單狀態與評分重新匯入到既有條目'
    },
    status: {
      missing: '未建立',
      enabled: '已啟用',
      disabled: '已停用'
    }
  },

  settings: {
    webviewTitle: 'MyAnimeList',
    commandLabel: '設定',
    commandDescription: '登入 MyAnimeList、匯入清單並設定刮削'
  },

  ui: {
    loading: '載入中…',
    unavailable: '無法載入 MyAnimeList 設定',
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
      signedIn: '已登入',
      notSignedIn: '未登入',
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
      runningJobs: '執行中的 MyAnimeList 任務',
      running: '執行中',
      idle: '閒置',
      quickActionsTitle: '快捷入口',
      importAction: '匯入 MyAnimeList 清單',
      maintenanceAction: '調整端點與用戶端選項',
      automationsTitle: '自動化範本'
    },

    account: {
      title: '帳號',
      description:
        '透過瀏覽器登入以連接 MyAnimeList 清單。登入直連 MyAnimeList，權杖會自動重新整理。',
      statusLabel: '狀態',
      configuredLabel: '已登入',
      missingLabel: '未登入',
      pendingLabel: '等待瀏覽器登入…',
      expiresAtLabel: '權杖有效期至',
      expiredLabel: '已過期',
      login: '使用 MyAnimeList 登入',
      cancelLogin: '取消登入',
      logout: '登出',
      verify: '驗證帳號',
      verifiedAs: ({ userName }) => `已以 ${userName} 的身分登入`
    },

    sync: {
      preferencesTitle: '自動推送偏好',
      syncEnabledLabel: '自動推送變更',
      syncEnabledDescription: '將帶有 MyAnimeList ID 條目的狀態與評分變更推送到清單',
      pushScoreLabel: '包含評分',
      pushScoreDescription: '將本機評分寫入 MyAnimeList。本機評分為空時不會清除遠端評分。',
      manualTitle: '手動推送',
      manualDescription: '將所有帶 MyAnimeList ID 的條目推送到清單。進度與取消由任務中心接管。',
      pushAll: '立即全量推送'
    },

    import: {
      title: '匯入清單',
      description: '將清單狀態與評分寫入相符的條目。建立缺漏條目時會經所選設定檔刮削完整中繼資料。',
      optionsLabel: '選項',
      listAnime: '動畫清單',
      listManga: '漫畫清單',
      updateExistingLabel: '更新既有條目',
      createMissingLabel: '建立缺漏條目',
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
      description:
        '此處僅建立推薦的 MyAnimeList 範本；啟用狀態、觸發器與歷史在應用的自動化頁面管理',
      create: '建立'
    },

    maintenance: {
      endpointTitle: '端點',
      endpointDescription: '官方 API 根位址與 Jikan 相容中繼資料鏡像',
      apiUrlLabel: 'API 位址',
      apiUrlDescription: 'MyAnimeList 官方 API v2 的根位址',
      mirrorEnabledLabel: '使用中繼資料鏡像',
      mirrorEnabledDescription: '角色、工作人員與劇集資料來自鏡像；關閉後這些欄位保持缺席',
      mirrorUrlLabel: '鏡像位址',
      mirrorUrlDescription: 'Jikan v4 相容 API 的根位址，如 Tenrai 或自架 Jikan',
      restoreDefaults: '還原官方端點',
      clientTitle: '刮削與用戶端',
      clientDescription: '套用於所有 MyAnimeList 搜尋與刮削',
      preferRomajiLabel: '優先羅馬字標題',
      preferRomajiDescription: '當沒有符合內容語言的標題時，使用羅馬字標題作為顯示名稱',
      timeoutLabel: '請求逾時',
      timeoutDescription: '等待單次回應的秒數',
      seconds: '秒',
      retryLabel: '重試次數',
      retryDescription: '限流或伺服器錯誤後的額外嘗試次數',
      retryUnit: '次',
      actionsTitle: '維護操作',
      actionsDescription: '這些操作立即生效且無法復原',
      reset: '還原預設設定',
      resetDescription: '端點與偏好將還原為預設值，登入狀態保留。'
    }
  }
}
