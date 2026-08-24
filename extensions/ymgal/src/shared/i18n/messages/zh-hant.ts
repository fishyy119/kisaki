import type { YmgalMessages } from '../index'

export const zhHant: YmgalMessages = {
  errors: {
    authFailed: '月幕拒絕了用戶端憑證，請在月幕擴充設定中檢查。',
    credentialRequired: '請同時填寫用戶端 ID 與用戶端密鑰。',
    notFound: '該月幕檔案不存在。',
    rateLimited: '月幕請求過於頻繁，請稍後再試。',
    rejected: '月幕介面拒絕了該請求。',
    unavailable: '月幕介面暫時無法使用。',
    networkFailed: '月幕介面網路請求失敗。',
    operationCancelled: '操作已取消。',
    baseUrlInvalid: '請輸入 http 或 https 位址。',
    idInvalid: ({ value }) => `「${value}」不是有效的月幕檔案 ID。`
  },

  settings: {
    webviewTitle: '月幕 Galgame',
    commandLabel: '設定',
    commandDescription: '設定月幕介面用戶端、位址與刮削偏好。'
  },

  ui: {
    loading: '載入中…',
    unavailable: '無法載入月幕設定。',
    saved: '偏好已儲存。',
    savePreferences: '儲存',
    discardChanges: '放棄變更',
    unsavedChanges: '有未儲存的變更',
    actionFailed: '操作失敗。',
    cancel: '取消',
    confirm: '確認',

    credentials: {
      title: '介面用戶端',
      description:
        '月幕提供公共共享用戶端，擴充預設使用它。僅當你申請了專屬用戶端時才需要填寫自己的憑證。',
      statusLabel: '目前用戶端',
      sharedLabel: '公共共享用戶端',
      customLabel: '你的專屬用戶端',
      clientIdLabel: '用戶端 ID',
      clientIdPlaceholder: '你的月幕用戶端 ID',
      clientSecretLabel: '用戶端密鑰',
      clientSecretPlaceholder: '你的月幕用戶端密鑰',
      save: '儲存用戶端',
      clear: '改用共享用戶端',
      test: '測試連線',
      saveSucceeded: '介面用戶端已儲存。',
      clearSucceeded: '已切回公共共享用戶端。',
      testSucceeded: '月幕已接受該介面用戶端。',
      openDeveloper: '前往 ymgal.games 申請用戶端'
    },

    endpoints: {
      title: '介面位址',
      description: '當官方位址無法連線時，可指向鏡像。',
      apiBaseUrlLabel: '介面基礎位址',
      apiBaseUrlDescription: '月幕開放介面的根位址。',
      restoreDefaults: '還原官方位址'
    },

    preferences: {
      title: '偏好設定',
      description: '套用於全部月幕搜尋與刮削。',
      preferChineseLabel: '優先使用中文標題',
      preferChineseDescription: '內容語言為中文時，將中文名作為顯示名稱。',
      timeoutLabel: '請求逾時',
      timeoutDescription: '等待單次月幕回應的秒數。',
      seconds: '秒',
      retryLabel: '重試次數',
      retryDescription: '遇到限流或伺服器錯誤後的額外嘗試次數。',
      retryUnit: '次',
      reset: '還原預設設定',
      resetDescription: '位址與偏好還原預設，用戶端憑證保留。',
      resetSucceeded: '已還原預設設定。'
    }
  }
}
