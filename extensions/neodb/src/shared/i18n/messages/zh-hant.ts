import type { NeodbMessages } from '../index'

export const zhHant: NeodbMessages = {
  errors: {
    authRequired: '請先登入 NeoDB 帳號',
    tokenRejected: 'NeoDB 登入已失效，請重新登入。',
    notFound: '該 NeoDB 條目不存在',
    rateLimited: '對 NeoDB 的請求過於頻繁，請稍後重試。',
    rejected: 'NeoDB API 拒絕了請求',
    unavailable: 'NeoDB 站台暫時無法使用',
    networkFailed: '對 NeoDB 的網路請求失敗',
    operationCancelled: '操作已取消',
    instanceUrlInvalid: '請輸入 http 或 https 位址',
    idInvalid: ({ value }) => `「${value}」不是有效的 NeoDB ID`,
    registrationFailed: '應用程式無法在該站台上完成自註冊',
    loginStateMismatch: 'NeoDB 登入回呼驗證失敗，請重新登入。',
    loginSessionExpired: 'NeoDB 登入工作階段已過期，請重新登入。',
    noPendingLogin: '沒有等待完成的 NeoDB 登入',
    loginNotReady: 'NeoDB 登入尚未就緒',
    codeEmpty: '請輸入授權碼',
    operationRunning: '已有 NeoDB 書架操作正在執行，請等待其完成。'
  },

  oauth: {
    loginSucceededTitle: 'NeoDB 登入成功',
    loginFailedTitle: 'NeoDB 登入失敗',
    loginCompleted: ({ userName }) => `已以 ${userName} 的身分登入`,
    callbackFailed: '無法完成 NeoDB 登入'
  },

  sync: {
    autoSyncFailedTitle: 'NeoDB 同步失敗',
    autoSyncFailedFallback: '無法將變更推送到 NeoDB',
    pushTaskTitle: '將媒體庫推送到 NeoDB 書架',
    pushSummary: ({ pushed, skipped, failed }) =>
      `已推送 ${pushed} 項、略過 ${skipped} 項、失敗 ${failed} 項`
  },

  import: {
    taskTitle: '匯入 NeoDB 書架',
    phaseRead: '正在讀取 NeoDB 書架',
    phaseApply: '正在套用書架條目',
    itemFailed: ({ id }) => `${id} 匯入失敗`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `新增 ${created} 項、更新 ${updated} 項、無變化 ${unchanged} 項、略過 ${skipped} 項、失敗 ${failed} 項`
  },

  settings: {
    webviewTitle: 'NeoDB',
    commandLabel: '設定',
    commandDescription: '登入 NeoDB 站台、匯入書架並設定刮削'
  },

  ui: {
    loading: '載入中…',
    unavailable: '無法載入 NeoDB 設定',
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
        '應用程式會在所選站台上自註冊並經瀏覽器登入，登入永不過期。若瀏覽器無法跳回應用程式，請使用授權碼方式。',
      statusLabel: '狀態',
      configuredLabel: '已登入',
      missingLabel: '未登入',
      pendingLabel: '等待瀏覽器登入…',
      manualPendingLabel: '等待輸入授權碼…',
      instanceLabel: ({ instanceUrl }) => `站台：${instanceUrl}`,
      login: '使用瀏覽器登入',
      manualLogin: '使用授權碼登入',
      codePlaceholder: '貼上授權碼',
      completeManual: '完成登入',
      cancelLogin: '取消登入',
      logout: '登出',
      verify: '驗證帳號',
      verifiedAs: ({ userName }) => `已以 ${userName} 的身分登入`
    },

    integration: {
      title: '書架聯動',
      syncEnabledLabel: '自動推送變更',
      syncEnabledDescription: '將帶有 NeoDB ID 條目的狀態與評分變更推送到書架',
      pushScoreLabel: '包含評分',
      pushScoreDescription: '將本機評分寫入書架標記。本機評分為空時不會清除遠端評分。',
      visibilityLabel: '標記可見性',
      visibilityDescription: '本應用程式寫入標記時的聯邦宇宙可見性',
      visibilityPublic: '公開',
      visibilityFollowers: '僅追蹤者',
      visibilitySelf: '僅自己',
      pushAll: '立即全量推送',
      importTitle: '匯入書架',
      importDescription:
        '將書架狀態與評分寫入相符的條目。建立缺漏條目時會經所選設定檔刮削完整中繼資料。',
      updateExistingLabel: '更新既有條目',
      createMissingLabel: '建立缺漏條目',
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
      title: '站台',
      description: '任意 NeoDB 部署均可使用，登入與其站台繫結',
      instanceUrlLabel: '站台位址',
      instanceUrlDescription: 'NeoDB 站台的根位址',
      restoreDefaults: '還原旗艦站台'
    },

    preferences: {
      title: '偏好',
      description: '套用於所有 NeoDB 請求',
      timeoutLabel: '請求逾時',
      timeoutDescription: '等待單次回應的秒數',
      seconds: '秒',
      retryLabel: '重試次數',
      retryDescription: '限流或伺服器錯誤後的額外嘗試次數',
      retryUnit: '次',
      reset: '還原預設設定',
      resetDescription: '站台與偏好將還原為預設值，登入狀態保留。',
      resetSucceeded: '已還原預設設定'
    }
  }
}
