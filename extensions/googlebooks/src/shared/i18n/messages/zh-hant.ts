import type { GbooksMessages } from '../index'

export const zhHant: GbooksMessages = {
  errors: {
    authRequired: '請先登入 Google 帳號',
    tokenExpired: 'Google 登入已過期，請重新登入。',
    notFound: '該 Google Books 卷不存在',
    rateLimited: 'Google Books 搜尋配額已用盡。可新增個人 API 金鑰或稍後重試。',
    rejected: 'Google Books API 拒絕了請求',
    unavailable: 'Google Books API 暫時無法使用',
    networkFailed: '對 Google Books 的網路請求失敗',
    relayUnavailable: 'Kisaki OAuth 中繼暫時無法使用，請稍後重試。',
    loginSessionExpired: 'Google 登入工作階段已過期，請重新登入。',
    loginCallbackInvalid: 'Google 登入回呼驗證失敗，請重新登入。',
    noPendingLogin: '沒有等待完成的 Google 登入',
    loginNotReady: 'Google 登入尚未就緒',
    operationCancelled: '操作已取消',
    baseUrlInvalid: '請輸入 http 或 https 位址',
    idInvalid: ({ value }) => `「${value}」不是有效的 Google Books 卷 ID`,
    keyEmpty: '請輸入 API 金鑰',
    operationRunning: '已有 Google Books 匯入正在執行，請等待其完成。'
  },

  oauth: {
    loginSucceededTitle: 'Google 登入成功',
    loginFailedTitle: 'Google 登入失敗',
    loginCompleted: '已連接 Google Books 書庫',
    callbackFailed: '無法完成 Google 登入'
  },

  import: {
    taskTitle: '匯入 Google Books 書庫',
    phaseRead: '正在讀取 Google Books 書架',
    phaseApply: '正在套用條目',
    itemFailed: ({ id }) => `${id} 匯入失敗`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `新增 ${created} 項、更新 ${updated} 項、無變化 ${unchanged} 項、略過 ${skipped} 項、失敗 ${failed} 項`
  },

  settings: {
    webviewTitle: 'Google Books',
    commandLabel: '設定',
    commandDescription: '登入 Google Books、匯入書庫並設定刮削'
  },

  ui: {
    loading: '載入中…',
    unavailable: '無法載入 Google Books 設定',
    saved: '設定已儲存',
    savePreferences: '儲存',
    discardChanges: '放棄',
    unsavedChanges: '有未儲存的變更',
    actionFailed: '操作失敗',
    cancel: '取消',
    confirm: '確認',

    account: {
      title: '帳號',
      description:
        '透過瀏覽器登入以連接 Google Books 書庫。搜尋無需登入；個人 API 金鑰為選用，用於提升搜尋配額。',
      statusLabel: '狀態',
      configuredLabel: '已登入',
      missingLabel: '未登入',
      pendingLabel: '等待瀏覽器登入…',
      login: '使用 Google 登入',
      completeLogin: '我已完成授權',
      cancelLogin: '取消登入',
      logout: '登出',
      apiKeyLabel: 'API 金鑰(選用)',
      apiKeyDescription: '用於提升搜尋配額，可在 Google Cloud 主控台建立',
      apiKeyPlaceholder: '貼上 API 金鑰',
      apiKeyConfigured: '已儲存 API 金鑰',
      saveKey: '儲存金鑰',
      clearKey: '移除金鑰'
    },

    integration: {
      title: '書庫匯入',
      description:
        '讀取已購書庫與閱讀書架，將狀態寫入相符條目，並經所選設定檔建立缺漏條目。Google Books 承載的是購買而非追蹤，因此不做反向推送。',
      includeEbooksLabel: '我的 Google 電子書',
      includeEbooksDescription: '已購與已上傳的書庫，匯入時不寫入狀態',
      includeShelvesLabel: '閱讀書架',
      includeShelvesDescription: '想讀、在讀、讀完將寫入為條目狀態',
      updateExistingLabel: '更新既有條目',
      createMissingLabel: '建立缺漏條目',
      mergeSeriesLabel: '合併系列分卷',
      mergeSeriesDescription: '同一系列的多卷只以第一卷建立條目',
      novelProfileLabel: '小說設定檔',
      comicProfileLabel: '漫畫設定檔',
      profilePlaceholder: '選擇設定檔',
      startImport: '匯入',
      taskProgress: ({ current, total }) => `${current} / ${total}`,
      taskRunning: '進行中',
      taskCompleted: '已完成',
      taskFailed: '失敗',
      taskCancelled: '已取消',
      cancelTask: '取消'
    },

    endpoints: {
      title: '端點',
      description: 'Google 登入經 Kisaki 中繼完成',
      relayUrlLabel: 'OAuth 中繼位址',
      relayUrlDescription: 'Kisaki 中繼上 Google Books 路由的根位址',
      restoreDefaults: '還原預設中繼'
    },

    preferences: {
      title: '偏好',
      description: '套用於所有 Google Books 請求',
      timeoutLabel: '請求逾時',
      timeoutDescription: '等待單次回應的秒數',
      seconds: '秒',
      retryLabel: '重試次數',
      retryDescription: '限流或伺服器錯誤後的額外嘗試次數',
      retryUnit: '次',
      reset: '還原預設設定',
      resetDescription: '端點與偏好將還原為預設值，登入狀態保留。',
      resetSucceeded: '已還原預設設定'
    }
  }
}
