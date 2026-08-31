import type { VndbMessages } from '../index'

export const zhHant: VndbMessages = {
  errors: {
    tokenInvalid: 'VNDB 拒絕了該介面權杖，請在 VNDB 擴充設定中檢查',
    tokenRequired: '請輸入 VNDB 介面權杖',
    notFound: '該 VNDB 條目不存在',
    rateLimited: 'VNDB 請求過於頻繁，請稍後再試',
    rejected: 'VNDB 介面拒絕了該請求',
    unavailable: 'VNDB 介面暫時無法使用',
    networkFailed: 'VNDB 介面網路請求失敗',
    operationCancelled: '操作已取消',
    baseUrlInvalid: '請輸入 http 或 https 位址',
    idInvalid: ({ value }) => `「${value}」不是有效的 VNDB ID`,
    listPermissionMissing:
      '該 VNDB 權杖無法讀取你的清單，請建立帶 listread 與 listwrite 權限的權杖',
    operationRunning: '已有 VNDB 清單操作正在執行，請等待其完成'
  },

  sync: {
    autoSyncFailedTitle: 'VNDB 同步失敗',
    autoSyncFailedFallback: '該變更未能推送到 VNDB',
    pushTaskTitle: '推送庫到 VNDB 清單',
    pushSummary: ({ pushed, skipped, failed }) =>
      `已推送 ${pushed}，跳過 ${skipped}，失敗 ${failed}`
  },

  import: {
    taskTitle: '匯入 VNDB 清單',
    phaseRead: '正在讀取 VNDB 清單',
    phaseApply: '正在套用清單條目',
    itemFailed: ({ id }) => `匯入 ${id} 失敗`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `新建 ${created}，更新 ${updated}，無變化 ${unchanged}，跳過 ${skipped}，失敗 ${failed}`
  },

  commands: {
    verifyAccount: {
      title: '驗證 VNDB 帳號',
      description: '向 VNDB 介面驗證已儲存的權杖及其清單權限'
    },
    pushAll: {
      title: '推送資料庫到 VNDB',
      description: '將所有帶 VNDB ID 的條目推送到清單'
    },
    importList: {
      title: '匯入 VNDB 清單',
      description: '將清單狀態與投票寫入相符的本機條目'
    }
  },

  automations: {
    names: {
      'auth-check': 'VNDB：啟動時驗證帳號',
      'push-full-daily': 'VNDB：每日全量推送',
      'import-refresh-weekly': 'VNDB：每週清單重新整理'
    },
    labels: {
      'auth-check': '啟動時驗證帳號',
      'push-full-daily': '每日全量推送',
      'import-refresh-weekly': '每週清單重新整理'
    },
    descriptions: {
      'auth-check': '應用啟動時驗證 VNDB 權杖及其清單權限',
      'push-full-daily': '每天凌晨將全部已關聯條目推送到 VNDB 清單',
      'import-refresh-weekly': '每週將清單狀態與投票重新匯入到既有條目'
    },
    status: {
      missing: '未建立',
      enabled: '已啟用',
      disabled: '已停用'
    }
  },

  settings: {
    webviewTitle: 'VNDB',
    commandLabel: '設定',
    commandDescription: '設定可選的 VNDB 介面權杖、位址與刮削偏好'
  },

  ui: {
    loading: '載入中…',
    unavailable: '無法載入 VNDB 設定',
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
      tokenConfigured: '已設定權杖',
      anonymous: '匿名存取',
      available: '可用',
      autoSyncLabel: '自動推送',
      enabled: '已啟用',
      disabled: '已停用',
      withScore: '狀態與投票',
      withoutScore: '僅狀態',
      recommendedAutomations: '推薦自動化',
      automationsComplete: '已全部建立',
      automationsMissing: ({ count }) => `${count} 項未建立`,
      templatesCount: ({ count }) => `${count} 個範本`,
      runtimeTitle: '執行狀態',
      runningJobs: '執行中的 VNDB 任務',
      running: '執行中',
      idle: '閒置',
      quickActionsTitle: '快捷入口',
      importAction: '匯入 VNDB 清單',
      maintenanceAction: '調整介面與用戶端選項',
      automationsTitle: '自動化範本'
    },

    account: {
      title: '介面權杖',
      description:
        'Kana 介面開放存取，無需權杖即可刮削。填寫個人權杖可提高速率上限；清單聯動需要 listread 與 listwrite 權限。',
      statusLabel: '狀態',
      inputLabel: '權杖',
      inputPlaceholder: '貼上你的 VNDB 權杖',
      configuredLabel: '已設定',
      missingLabel: '匿名存取',
      save: '儲存權杖',
      clear: '移除權杖',
      test: '測試連線',
      saveSucceeded: '介面權杖已儲存',
      clearSucceeded: '介面權杖已移除',
      testSucceeded: 'VNDB 已接受該請求',
      openSettings: '前往 vndb.org 建立權杖',
      verify: '驗證帳號',
      verifiedAs: ({ username }) => `已登入為 ${username}`,
      permissionsLabel: '清單權限',
      listRead: '讀取',
      listWrite: '寫入',
      permissionGranted: '已授權',
      permissionMissing: '缺失'
    },

    sync: {
      preferencesTitle: '自動推送偏好',
      preferencesDescription: '推送到清單需要帶 listread 與 listwrite 權限的權杖',
      syncEnabledLabel: '自動推送變更',
      syncEnabledDescription: '帶 VNDB ID 的條目的狀態與評分修改會推送到你的清單',
      pushScoreLabel: '包含評分',
      pushScoreDescription: '將本機評分寫入為 VNDB 投票；本機評分為空時不會清除遠端投票',
      manualTitle: '手動推送',
      manualDescription: '將所有帶 VNDB ID 的條目推送到清單。進度與取消由任務中心接管。',
      pushAll: '立即全量推送'
    },

    import: {
      title: '匯入清單',
      description: '將清單狀態與投票寫入相符的條目。新建缺失條目時透過所選設定檔刮削。',
      optionsLabel: '選項',
      updateExistingLabel: '更新既有條目',
      createMissingLabel: '新建缺失條目',
      profileLabel: '遊戲設定檔',
      profilePlaceholder: '選擇設定檔',
      runLabel: '執行匯入',
      runDescription: '以應用任務執行；以上選項僅作用於本次執行',
      startImport: '匯入'
    },

    automation: {
      title: '推薦自動化',
      description: '此處僅建立推薦的 VNDB 範本；啟用狀態、觸發器與歷史在應用的自動化頁面管理',
      create: '建立'
    },

    maintenance: {
      endpointTitle: '介面位址',
      endpointDescription: '當官方位址無法連線時，可指向鏡像',
      apiBaseUrlLabel: '介面基礎位址',
      apiBaseUrlDescription: 'VNDB Kana 介面的根位址',
      restoreDefaults: '還原官方位址',
      clientTitle: '刮削與用戶端',
      clientDescription: '套用於全部 VNDB 搜尋與刮削',
      preferRomanizedLabel: '優先使用羅馬字標題',
      preferRomanizedDescription: '當內容語言沒有對應標題時，使用羅馬字標題作為顯示名稱',
      timeoutLabel: '請求逾時',
      timeoutDescription: '等待單次 VNDB 回應的秒數',
      seconds: '秒',
      retryLabel: '重試次數',
      retryDescription: '遇到限流或伺服器錯誤後的額外嘗試次數',
      retryUnit: '次',
      actionsTitle: '維護操作',
      actionsDescription: '這些操作立即生效且無法復原',
      reset: '還原預設設定',
      resetDescription: '位址與偏好還原預設，權杖保留',
      resetSucceeded: '已還原預設設定'
    }
  }
}
