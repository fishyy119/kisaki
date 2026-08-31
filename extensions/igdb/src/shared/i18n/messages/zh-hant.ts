import type { IgdbMessages } from '../index'

export const zhHant: IgdbMessages = {
  errors: {
    credentialMissing: '請先在 IGDB 擴充設定中填寫 Twitch 用戶端 ID 與密鑰',
    credentialInvalid: 'Twitch 拒絕了該用戶端憑證，請在 IGDB 擴充設定中檢查',
    credentialRequired: '請同時填寫用戶端 ID 與用戶端密鑰',
    notFound: '該 IGDB 條目不存在',
    rateLimited: 'IGDB 請求過於頻繁，請稍後再試',
    rejected: 'IGDB 介面拒絕了該請求',
    unavailable: 'IGDB 介面暫時無法使用',
    networkFailed: 'IGDB 介面網路請求失敗',
    operationCancelled: '操作已取消',
    baseUrlInvalid: '請輸入 http 或 https 位址',
    idInvalid: ({ value }) => `「${value}」不是有效的 IGDB ID`
  },

  settings: {
    webviewTitle: 'IGDB',
    commandLabel: '設定',
    commandDescription: '設定 IGDB 認證所用的 Twitch 用戶端與介面位址'
  },

  ui: {
    loading: '載入中…',
    unavailable: '無法載入 IGDB 設定',
    savePreferences: '儲存',
    discardChanges: '放棄變更',
    unsavedChanges: '有未儲存的變更',
    actionFailed: '操作失敗',
    cancel: '取消',
    confirm: '確認',

    credentials: {
      title: 'Twitch 用戶端',
      description:
        'IGDB 透過 Twitch 認證。請在 Twitch 開發者主控台註冊應用程式，並填寫其用戶端 ID 與密鑰。',
      statusLabel: '狀態',
      clientIdLabel: '用戶端 ID',
      clientIdPlaceholder: '你的 Twitch 用戶端 ID',
      clientSecretLabel: '用戶端密鑰',
      clientSecretPlaceholder: '你的 Twitch 用戶端密鑰',
      configuredLabel: '已設定',
      missingLabel: '未設定',
      save: '儲存用戶端',
      clear: '移除用戶端',
      test: '測試連線',
      testSucceeded: 'Twitch 已接受該用戶端憑證',
      openConsole: '前往 dev.twitch.tv 註冊應用程式'
    },

    endpoints: {
      title: '介面位址',
      description: '當官方位址無法連線時，可指向鏡像',
      apiBaseUrlLabel: '介面基礎位址',
      apiBaseUrlDescription: 'IGDB v4 介面的根位址',
      oauthUrlLabel: 'OAuth 權杖位址',
      oauthUrlDescription: '簽發用戶端憑證權杖的 Twitch 端點',
      restoreDefaults: '還原官方位址'
    },

    preferences: {
      title: '偏好設定',
      description: '套用於全部 IGDB 搜尋與刮削',
      timeoutLabel: '請求逾時',
      timeoutDescription: '等待單次 IGDB 回應的秒數',
      seconds: '秒',
      retryLabel: '重試次數',
      retryDescription: '遇到限流或伺服器錯誤後的額外嘗試次數',
      retryUnit: '次',
      reset: '還原預設設定',
      resetDescription: '位址與偏好還原預設，Twitch 用戶端保留'
    }
  }
}
