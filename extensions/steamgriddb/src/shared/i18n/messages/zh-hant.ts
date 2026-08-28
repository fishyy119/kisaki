import type { SgdbMessages } from '../index'

export const zhHant: SgdbMessages = {
  errors: {
    keyRequired: '請先儲存 SteamGridDB API 金鑰',
    keyRejected: 'SteamGridDB 拒絕了該 API 金鑰',
    notFound: '該 SteamGridDB 條目不存在',
    rateLimited: '對 SteamGridDB 的請求過於頻繁，請稍後重試。',
    rejected: 'SteamGridDB API 拒絕了請求',
    unavailable: 'SteamGridDB API 暫時無法使用',
    networkFailed: '對 SteamGridDB 的網路請求失敗',
    operationCancelled: '操作已取消',
    idInvalid: ({ value }) => `「${value}」不是有效的 SteamGridDB ID`,
    keyEmpty: '請輸入 API 金鑰'
  },

  settings: {
    webviewTitle: 'SteamGridDB',
    commandLabel: '設定',
    commandDescription: '設定 SteamGridDB API 金鑰與美術偏好'
  },

  ui: {
    loading: '載入中…',
    unavailable: '無法載入 SteamGridDB 設定',
    saved: '設定已儲存',
    savePreferences: '儲存',
    discardChanges: '放棄',
    unsavedChanges: '有未儲存的變更',
    actionFailed: '操作失敗',
    cancel: '取消',
    confirm: '確認',

    account: {
      title: 'API 金鑰',
      description: 'SteamGridDB 需要免費的個人 API 金鑰。儲存時會透過一次探測請求驗證。',
      statusLabel: '狀態',
      configuredLabel: '已儲存金鑰',
      missingLabel: '未儲存金鑰',
      keyLabel: 'API 金鑰',
      keyPlaceholder: '貼上 API 金鑰',
      saveKey: '儲存金鑰',
      clearKey: '移除金鑰',
      openKeyPage: '取得 API 金鑰'
    },

    preferences: {
      title: '偏好',
      description: '套用於所有美術請求',
      includeNsfwLabel: '包含 NSFW 美術',
      includeNsfwDescription: '同時傳回社群標記為 NSFW 的美術',
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
