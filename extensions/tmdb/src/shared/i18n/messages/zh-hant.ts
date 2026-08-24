import type { TmdbMessages } from '../index'

export const zhHant: TmdbMessages = {
  errors: {
    apiKeyMissing: '請先在 TMDB 擴充功能設定中填寫 API Key。',
    apiKeyInvalid: 'TMDB 拒絕了該 API Key，請在 TMDB 擴充功能設定中檢查。',
    apiKeyRequired: '請輸入 TMDB API Key。',
    notFound: '該 TMDB 條目不存在。',
    rateLimited: 'TMDB 請求過於頻繁，請稍後再試。',
    rejected: 'TMDB 介面拒絕了本次請求。',
    unavailable: 'TMDB 介面暫時無法使用。',
    networkFailed: 'TMDB 介面網路請求失敗。',
    operationCancelled: '操作已取消。',
    baseUrlInvalid: '請輸入 http 或 https 位址。',
    idInvalid: ({ value }) => `「${value}」不是有效的 TMDB id。`,
    referenceInvalid: ({ value }) =>
      `「${value}」不是有效的 TMDB 參照。請使用 movie:<id>、tv:<id>、tv:<id>:s<季號>、tv:<id>:eg:<劇集組 id>:<分組 id>，或 themoviedb.org 連結。`,
    episodeGroupEmpty: ({ setId }) => `TMDB 劇集組 ${setId} 不包含任何分組。`,
    episodeGroupMissing: ({ setId, groupId }) => `TMDB 劇集組 ${setId} 中沒有分組 ${groupId}。`
  },

  settings: {
    webviewTitle: 'TMDB',
    commandLabel: '設定',
    commandDescription: '設定 TMDB API Key、介面位址與刮削偏好。'
  },

  ui: {
    loading: '載入中…',
    unavailable: '無法載入 TMDB 設定。',
    saved: '偏好已儲存。',
    savePreferences: '儲存',
    discardChanges: '放棄修改',
    unsavedChanges: '有未儲存的修改',
    actionFailed: '操作失敗。',
    cancel: '取消',
    confirm: '確認',

    credentials: {
      title: 'API Key',
      description: 'TMDB 需要個人金鑰，v3 API Key 與 v4 讀取權杖皆可使用。',
      statusLabel: '狀態',
      inputLabel: '金鑰或權杖',
      inputPlaceholder: '貼上你的 TMDB 金鑰',
      configuredLabel: '已設定',
      missingLabel: '未設定',
      modeApiKey: 'v3 API Key',
      modeBearer: 'v4 讀取權杖',
      save: '儲存金鑰',
      clear: '移除金鑰',
      test: '測試連線',
      saveSucceeded: 'API Key 已儲存。',
      clearSucceeded: 'API Key 已移除。',
      testSucceeded: 'TMDB 已接受該 API Key。',
      openSettings: '前往 themoviedb.org 申請金鑰'
    },

    endpoints: {
      title: '介面位址',
      description: '官方位址無法連線時，可改為鏡像位址。',
      apiBaseUrlLabel: 'API 位址',
      apiBaseUrlDescription: 'TMDB v3 REST 介面根位址。',
      imageBaseUrlLabel: '圖片位址',
      imageBaseUrlDescription: 'TMDB 圖片 CDN 根位址，不含尺寸區段。',
      restoreDefaults: '還原官方位址'
    },

    episodeGroups: {
      title: '劇集組',
      description:
        '劇集組是 TMDB 社群為一部劇維護的另一套集數編排，例如長篇的連續絕對集號。預設仍依播出季刮削，劇集組按條目單獨選擇。',
      stepPaste: '在動漫搜尋框貼上劇 id、劇集組 id 或任何 themoviedb.org 連結，然後搜尋。',
      stepPick: '結果會列出該劇的每一季，以及每個劇集組的每個分組。選擇條目要採用的分組。',
      stepSwitch:
        '把條目改到另一個分組只是再刮削一次：每集依 TMDB episode id 重新對齊，因此只有集號改變，觀看記錄不受影響。',
      inputsLabel: '搜尋框可接受的輸入',
      idsLabel: '已知分組時，ID 輸入框可接受的輸入'
    },

    preferences: {
      title: '偏好',
      description: '對所有 TMDB 搜尋與刮削生效。',
      includeAdultLabel: '包含成人內容',
      includeAdultDescription: '允許 TMDB 搜尋回傳標記為成人的條目。',
      timeoutLabel: '請求逾時',
      timeoutDescription: '單次 TMDB 回應的等待秒數。',
      seconds: '秒',
      retryLabel: '重試次數',
      retryDescription: '遇到限流或伺服器錯誤後的額外嘗試次數。',
      retryUnit: '次',
      reset: '還原預設設定',
      resetDescription: '介面位址與偏好將還原為預設值，API Key 會保留。',
      resetSucceeded: '已還原預設設定。'
    }
  }
}
