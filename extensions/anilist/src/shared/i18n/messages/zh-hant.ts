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
    operationRunning: '已有 AniList 清單操作正在執行，請等待其完成'
  },

  oauth: {
    loginSucceededTitle: 'AniList 登入完成',
    loginFailedTitle: 'AniList 登入失敗',
    loginCompleted: ({ userName }) => `已登入為 ${userName}`,
    callbackFailed: 'AniList 登入未能完成'
  },

  sync: {
    autoSyncFailedTitle: 'AniList 同步失敗',
    autoSyncFailedFallback: '該變更未能推送到 AniList',
    pushTaskTitle: '推送庫到 AniList 清單',
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

    account: {
      title: '帳號',
      description: '透過瀏覽器登入以連接你的 AniList 清單。權杖約一年有效，且無法續期。',
      statusLabel: '狀態',
      configuredLabel: '已登入',
      missingLabel: '未登入',
      pendingLabel: '等待瀏覽器登入…',
      login: '使用 AniList 登入',
      completeLogin: '我已完成授權',
      cancelLogin: '取消登入',
      logout: '登出',
      verify: '驗證帳號',
      verifiedAs: ({ userName }) => `已登入為 ${userName}`
    },

    integration: {
      title: '清單整合',
      syncEnabledLabel: '自動推送變更',
      syncEnabledDescription: '帶 AniList ID 的條目的狀態與評分修改會推送到你的清單',
      pushScoreLabel: '包含評分',
      pushScoreDescription: '將本機評分寫入 AniList；本機評分為空時不會清除遠端評分',
      pushAll: '立即全量推送',
      importTitle: '匯入清單',
      importDescription: '將清單狀態與評分寫入相符的條目。新建缺失條目時透過所選設定檔刮削。',
      listAnime: '動畫清單',
      listManga: '漫畫清單',
      updateExistingLabel: '更新既有條目',
      createMissingLabel: '新建缺失條目',
      animeProfileLabel: '動畫設定檔',
      comicProfileLabel: '漫畫設定檔',
      novelProfileLabel: '小說設定檔',
      profilePlaceholder: '選擇設定檔',
      startImport: '匯入',
      taskProgress: ({ current, total }) => `${current} / ${total}`,
      taskRunning: '執行中',
      taskCompleted: '已完成',
      taskFailed: '已失敗',
      taskCancelled: '已取消',
      cancelTask: '取消'
    },

    endpoints: {
      title: '介面位址',
      description: '當官方位址無法連線時，可指向鏡像',
      graphqlUrlLabel: 'GraphQL 位址',
      graphqlUrlDescription: 'AniList GraphQL 介面的根位址',
      relayUrlLabel: 'OAuth 中繼位址',
      relayUrlDescription: '完成 AniList 登入的 Kisaki 中繼路由',
      restoreDefaults: '還原官方位址'
    },

    preferences: {
      title: '偏好設定',
      description: '套用於全部 AniList 搜尋與刮削',
      preferRomajiLabel: '優先使用羅馬字標題',
      preferRomajiDescription: '當內容語言沒有對應標題時，使用羅馬字標題作為顯示名稱',
      timeoutLabel: '請求逾時',
      timeoutDescription: '等待單次 AniList 回應的秒數',
      seconds: '秒',
      retryLabel: '重試次數',
      retryDescription: '遇到限流或伺服器錯誤後的額外嘗試次數',
      retryUnit: '次',
      reset: '還原預設設定',
      resetDescription: '位址與偏好還原預設，登入保留',
      resetSucceeded: '已還原預設設定'
    }
  }
}
