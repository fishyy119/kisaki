import type { SteamMessages } from '../index'

export const zhHant: SteamMessages = {
  errors: {
    keyRequired: '請先儲存 Steam Web API 金鑰',
    steamIdInvalid: '請輸入有效的 SteamID64(以 7656 開頭的 17 位數字)',
    keyRejected: 'Steam 拒絕了該 Web API 金鑰',
    profileRequired: '請先建立遊戲刮削設定檔',
    profileNotVisible: 'Steam 未回傳任何遊戲。請檢查 SteamID，並確認個人資料中的遊戲詳情已公開。',
    notFound: '該 Steam 應用不存在或未在商店公開',
    rateLimited: '對 Steam 的請求過於頻繁，請稍後重試。',
    rejected: 'Steam API 拒絕了請求',
    unavailable: 'Steam API 暫時無法使用',
    networkFailed: '對 Steam 的網路請求失敗',
    operationCancelled: '操作已取消',
    idInvalid: ({ value }) => `「${value}」不是有效的 Steam 應用 ID`,
    keyEmpty: '請輸入 Web API 金鑰',
    operationRunning: '已有 Steam 匯入正在執行，請等待其完成。'
  },

  import: {
    taskTitle: '匯入已擁有的 Steam 遊戲',
    phaseRead: '正在讀取擁有的遊戲',
    phaseApply: '正在建立條目',
    itemFailed: ({ id }) => `${id} 匯入失敗`,
    summary: ({ created, existing, failed }) =>
      `新建 ${created} 項、已存在 ${existing} 項、失敗 ${failed} 項`
  },

  commands: {
    verifyAccount: {
      title: '驗證 Steam 帳號',
      description: '透過統計擁有的遊戲驗證已儲存的 Web API 金鑰與 SteamID'
    },
    importOwned: {
      title: '匯入已擁有的 Steam 遊戲',
      description: '為庫中尚不存在的已擁有遊戲建立條目'
    }
  },

  automations: {
    names: {
      'auth-check': 'Steam：啟動時驗證帳號',
      'import-refresh-weekly': 'Steam：每週匯入已擁有遊戲'
    },
    labels: {
      'auth-check': '啟動時驗證帳號',
      'import-refresh-weekly': '每週匯入已擁有遊戲'
    },
    descriptions: {
      'auth-check': '應用啟動時驗證 Steam Web API 金鑰與 SteamID',
      'import-refresh-weekly': '每週透過範本固化的設定檔匯入新擁有的遊戲'
    },
    status: {
      missing: '未建立',
      enabled: '已啟用',
      disabled: '已停用'
    }
  },

  settings: {
    webviewTitle: 'Steam',
    commandLabel: '設定',
    commandDescription: '連接 Steam 帳號、匯入已擁有遊戲並設定刮削'
  },

  ui: {
    loading: '載入中…',
    unavailable: '無法載入 Steam 設定',
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
      keyConfigured: '已儲存金鑰',
      noKey: '未儲存金鑰',
      available: '可用',
      recommendedAutomations: '推薦自動化',
      automationsComplete: '已全部建立',
      automationsMissing: ({ count }) => `${count} 項未建立`,
      templatesCount: ({ count }) => `${count} 個範本`,
      runtimeTitle: '執行狀態',
      runningJobs: '執行中的 Steam 任務',
      running: '執行中',
      idle: '閒置',
      quickActionsTitle: '快捷入口',
      importAction: '匯入已擁有的 Steam 遊戲',
      maintenanceAction: '調整用戶端選項',
      automationsTitle: '自動化範本'
    },

    account: {
      title: '帳號',
      description:
        '匯入已擁有遊戲需要個人 Web API 金鑰與帳號的 SteamID64，且個人資料中的遊戲詳情需設為公開。',
      statusLabel: '狀態',
      configuredLabel: '已儲存金鑰',
      missingLabel: '未儲存金鑰',
      keyLabel: 'Web API 金鑰',
      keyPlaceholder: '貼上 Web API 金鑰',
      steamIdLabel: 'SteamID64',
      steamIdDescription: '17 位數字，可在個人資料頁 URL 或第三方工具中查看',
      saveKey: '儲存金鑰',
      clearKey: '移除金鑰',
      verify: '驗證',
      verifiedGames: ({ count }) => `可見 ${count} 款遊戲`,
      openKeyPage: '取得 Web API 金鑰'
    },

    import: {
      title: '已擁有遊戲匯入',
      description: '讀取擁有的遊戲庫，並經所選設定檔建立缺漏條目。已帶有 Steam ID 的條目保持不變。',
      profileLabel: '遊戲設定檔',
      profilePlaceholder: '選擇設定檔',
      runLabel: '執行匯入',
      runDescription: '以應用任務執行；以上選項僅作用於本次執行',
      startImport: '匯入已擁有遊戲'
    },

    automation: {
      title: '推薦自動化',
      description: '此處僅建立推薦的 Steam 範本；啟用狀態、觸發器與歷史在應用的自動化頁面管理',
      create: '建立'
    },

    maintenance: {
      clientTitle: '用戶端',
      clientDescription: '套用於所有 Steam 請求',
      timeoutLabel: '請求逾時',
      timeoutDescription: '等待單次回應的秒數',
      seconds: '秒',
      retryLabel: '重試次數',
      retryDescription: '限流或伺服器錯誤後的額外嘗試次數',
      retryUnit: '次',
      actionsTitle: '維護操作',
      actionsDescription: '這些操作立即生效且無法復原',
      reset: '還原預設設定',
      resetDescription: '偏好將還原為預設值，已儲存的金鑰保留。'
    }
  }
}
