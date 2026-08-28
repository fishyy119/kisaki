import type { SteamMessages } from '../index'

export const zhHant: SteamMessages = {
  errors: {
    keyRequired: '請先儲存 Steam Web API 金鑰',
    steamIdInvalid: '請輸入有效的 SteamID64(以 7656 開頭的 17 位數字)',
    keyRejected: 'Steam 拒絕了該 Web API 金鑰',
    profileNotVisible: 'Steam 未傳回任何遊戲。請檢查 SteamID，並確認個人資料中的遊戲詳情已公開。',
    notFound: '該 Steam 應用程式不存在或未在商店公開',
    rateLimited: '對 Steam 的請求過於頻繁，請稍後重試。',
    rejected: 'Steam API 拒絕了請求',
    unavailable: 'Steam API 暫時無法使用',
    networkFailed: '對 Steam 的網路請求失敗',
    operationCancelled: '操作已取消',
    idInvalid: ({ value }) => `「${value}」不是有效的 Steam 應用程式 ID`,
    keyEmpty: '請輸入 Web API 金鑰',
    operationRunning: '已有 Steam 匯入正在執行，請等待其完成。'
  },

  import: {
    taskTitle: '匯入已擁有的 Steam 遊戲',
    phaseRead: '正在讀取擁有的遊戲',
    phaseApply: '正在建立條目',
    itemFailed: ({ id }) => `${id} 匯入失敗`,
    summary: ({ created, existing, failed }) =>
      `新增 ${created} 項、已存在 ${existing} 項、失敗 ${failed} 項`
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

    integration: {
      title: '已擁有遊戲匯入',
      description: '讀取擁有的遊戲庫，並經所選設定檔建立缺漏條目。已帶有 Steam ID 的條目保持不變。',
      profileLabel: '遊戲設定檔',
      profilePlaceholder: '選擇設定檔',
      startImport: '匯入已擁有遊戲',
      taskProgress: ({ current, total }) => `${current} / ${total}`,
      taskRunning: '進行中',
      taskCompleted: '已完成',
      taskFailed: '失敗',
      taskCancelled: '已取消',
      cancelTask: '取消'
    },

    preferences: {
      title: '偏好',
      description: '套用於所有 Steam 請求',
      timeoutLabel: '請求逾時',
      timeoutDescription: '等待單次回應的秒數',
      seconds: '秒',
      retryLabel: '重試次數',
      retryDescription: '限流或伺服器錯誤後的額外嘗試次數',
      retryUnit: '次',
      reset: '還原預設設定',
      resetDescription: '偏好將還原為預設值，已儲存的金鑰保留。',
      resetSucceeded: '已還原預設設定'
    }
  }
}
