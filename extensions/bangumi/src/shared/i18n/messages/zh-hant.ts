/** Traditional Chinese message catalog for the Bangumi extension. */

import type { BangumiMediaScope } from '../../scopes'
import type { en } from './en'

type Scope = BangumiMediaScope
type CollectionType = 1 | 2 | 3 | 4 | 5

/** Scope noun with its measure word, used after a count. */
const COUNT_NOUNS: Record<Scope, string> = {
  book: '本書籍',
  game: '個遊戲',
  anime: '部動畫',
  music: '個音樂條目'
}

const NOUNS: Record<Scope, string> = {
  book: '書籍',
  game: '遊戲',
  anime: '動畫',
  music: '音樂條目'
}

const SCOPES: Record<Scope, string> = {
  book: '書籍',
  game: '遊戲',
  anime: '動畫',
  music: '音樂'
}

const COLLECTIONS: Record<Scope, Record<CollectionType, string>> = {
  book: { 1: '想讀', 2: '讀過', 3: '在讀', 4: '擱置', 5: '拋棄' },
  game: { 1: '想玩', 2: '玩過', 3: '在玩', 4: '擱置', 5: '拋棄' },
  anime: { 1: '想看', 2: '看過', 3: '在看', 4: '擱置', 5: '拋棄' },
  music: { 1: '想聽', 2: '聽過', 3: '在聽', 4: '擱置', 5: '拋棄' }
}

function countOf(scope: Scope, count: number): string {
  return `${count} ${COUNT_NOUNS[scope]}`
}

export const zhHant = {
  common: {
    cancel: '取消',
    close: '關閉',
    confirm: '確認',
    create: '建立',
    preview: '預覽',
    none: '無',
    listSeparator: '、'
  },

  media: {
    scopes: SCOPES,
    collections: COLLECTIONS
  },

  errors: {
    authRequired: '請先登入 Bangumi 帳號',
    authSessionInvalid: 'Bangumi 工作階段已失效，請重新登入',
    tokenRefreshFailed: 'Bangumi 憑證重新整理失敗，請重新登入',
    refreshTokenMissing: '不存在 Bangumi 重新整理權杖，請重新登入',
    tokenSaveFailed: 'Bangumi 憑證儲存失敗',

    loginNotReady: 'Bangumi 登入尚未就緒',
    loginSessionExpired: 'Bangumi 登入工作階段已過期，請重新登入',
    loginCallbackInvalid: 'Bangumi 登入回呼驗證失敗，請重新登入',
    noPendingLogin: '沒有等待完成的 Bangumi 登入',

    relayUnavailable: 'Kisaki OAuth 中繼暫時無法使用，請稍後再試',

    apiNotFound: 'Bangumi 條目不存在',
    apiRateLimited: 'Bangumi API 請求過於頻繁，請稍後再試',
    apiRejected: 'Bangumi API 拒絕了本次請求',
    apiUnavailable: 'Bangumi API 暫時無法使用',
    networkFailed: 'Bangumi API 網路請求失敗',
    accountResponseInvalid: '無法識別 Bangumi 帳號回應',
    idInvalid: ({ value }) => `「${value}」不是有效的 Bangumi ID`,

    operationCancelled: '操作已取消',
    jobCancelled: 'Bangumi 任務已取消',
    jobFailed: 'Bangumi 任務失敗',
    jobAlreadyRunning: '該 Bangumi 任務正在執行，請等待完成或先取消',

    invalidMediaScope: '請選擇有效的 Bangumi 媒體類型',
    mediaScopeNotRegistered: '該 Bangumi 媒體類型未註冊',
    localWriteUnsupported: ({ scope }: { scope: Scope }) =>
      `${SCOPES[scope]}暫不支援寫入本機媒體庫`,
    localWriteUnsupportedGeneric: '該媒體類型暫不支援寫入本機媒體庫',

    localMediaMissing: '本機條目不存在',
    bookKindUnresolved: 'Bangumi 未說明該書籍是漫畫還是小說，因此未匯入',
    localItemMissing: '本機條目不存在',
    importedItemMissing: '已匯入的本機條目不存在',
    targetCollectionMissing: '所選目標合集不存在',
    selectTargetCollection: '請選擇目標合集',
    indexTitleEmpty: 'Bangumi 目錄標題為空，無法建立合集',
    indexInputRequired: '請輸入 Bangumi 目錄 ID 或連結',
    indexInputInvalid:
      'Bangumi 目錄需要是數字 ID，或形如 https://bgm.tv/index/<id>、https://bangumi.tv/index/<id> 的連結',
    indexSubjectMissingId: 'Bangumi 目錄條目缺少有效的條目 ID',
    collectionMissingSubjectId: 'Bangumi 收藏缺少有效的條目 ID',
    profileRequired: '請選擇用於建立本機項目的刮削設定檔',
    profileNotFound: '所選刮削設定檔不存在'
  },

  oauth: {
    loginSucceededTitle: 'Bangumi 登入成功',
    loginFailedTitle: 'Bangumi 登入失敗',
    loginCompleted: ({ nickname }: { nickname: string }) => `Bangumi 已登入：${nickname}`,
    callbackFailed: 'Bangumi 登入回呼失敗，請返回設定頁面重試'
  },

  notifications: {
    autoSyncFailedTitle: 'Bangumi 自動同步失敗',
    autoSyncFailedFallback: 'Bangumi 自動同步失敗'
  },

  commands: {
    authRefresh: {
      title: '重新整理 Bangumi 憑證',
      description: '重新整理 Bangumi 權杖並驗證目前帳號'
    },
    syncChanged: {
      title: '同步已變更的 Bangumi 條目',
      description: '同步本次執行期間排入佇列的本機條目變更'
    },
    syncFull: {
      title: 'Bangumi 全量同步',
      description: '掃描本機項目並同步 Bangumi 收藏狀態與評分'
    },
    importCollections: {
      title: '匯入我的 Bangumi 收藏',
      description: '按媒體類型匯入目前 Bangumi 使用者的收藏'
    },
    importIndex: {
      title: '匯入 Bangumi 目錄',
      description: '按媒體類型從 Bangumi 目錄匯入條目'
    }
  },

  jobs: {
    completed: 'Bangumi 任務已完成',
    cancelled: 'Bangumi 任務已取消',

    auth: {
      refreshingToken: '正在重新整理 Bangumi 憑證…',
      verifyingAccount: '正在驗證 Bangumi 帳號…',
      accountValid: ({ nickname }: { nickname: string }) => `Bangumi 帳號有效：${nickname}`,
      accountRefreshed: ({ nickname }: { nickname: string }) =>
        `Bangumi 帳號摘要已更新：${nickname}`
    },

    sync: {
      loadingQueue: '正在讀取 Bangumi 變更佇列…',
      syncingQueue: '正在同步 Bangumi 變更佇列…',
      queueUnsupported: ({ scope }: { scope: Scope }) => `${SCOPES[scope]}暫不支援本機變更同步`,
      queueCompleted: ({ count }: { count: number }) => `變更佇列同步完成：已同步 ${count} 個條目`,
      fullUnsupported: ({ scope }: { scope: Scope }) => `${SCOPES[scope]}暫不支援本機全量同步`,
      fullCompleted: ({ count, scope }: { count: number; scope: Scope }) =>
        `全量同步完成：已同步 ${countOf(scope, count)}`,
      previewCompleted: ({ count, scope }: { count: number; scope: Scope }) =>
        `全量同步預覽完成：可同步 ${countOf(scope, count)}`,
      scanningItems: ({ scope }: { scope: Scope }) => `正在掃描${NOUNS[scope]}…`,
      collectingItems: ({ scope }: { scope: Scope }) => `正在計算待同步的${NOUNS[scope]}…`,
      previewingItems: '正在預覽 Bangumi 全量同步…',
      applyingItems: '正在同步 Bangumi 全量同步條目…'
    },

    import: {
      validating: '正在檢查 Bangumi 匯入參數…',
      validatingIndex: '正在檢查 Bangumi 目錄匯入參數…',
      readingCollections: ({ scope, type }: { scope: Scope; type: CollectionType }) =>
        `正在讀取 Bangumi「${COLLECTIONS[scope][type]}」收藏…`,
      readingIndex: '正在讀取 Bangumi 目錄條目…',
      matchingLocal: ({ scope }: { scope: Scope }) => `正在比對${NOUNS[scope]}…`,
      collectingPlan: ({ scope }: { scope: Scope }) => `正在計算待匯入的${NOUNS[scope]}…`,
      preparing: ({ scope }: { scope: Scope }) => `正在準備匯入${NOUNS[scope]}…`,
      creatingLocal: ({ scope }: { scope: Scope }) => `正在新增${NOUNS[scope]}…`,
      patchingLocal: ({ scope }: { scope: Scope }) => `正在更新${NOUNS[scope]}…`,
      writeUnsupported: ({ scope }: { scope: Scope }) => `${SCOPES[scope]}暫不支援寫入本機媒體庫`,
      collectionsCompleted: ({
        added,
        updated,
        scope
      }: {
        added: number
        updated: number
        scope: Scope
      }) => `收藏匯入完成：新增 ${countOf(scope, added)}，更新既有 ${updated} 個`,
      collectionsPreviewCompleted: ({
        toImport,
        toPatch,
        scope
      }: {
        toImport: number
        toPatch: number
        scope: Scope
      }) => `收藏匯入預覽完成：將匯入 ${countOf(scope, toImport)}，將更新既有 ${toPatch} 個`,
      indexCompleted: ({
        added,
        updated,
        scope
      }: {
        added: number
        updated: number
        scope: Scope
      }) => `目錄匯入完成：新增 ${countOf(scope, added)}，更新既有 ${updated} 個`,
      indexPreviewCompleted: ({
        toImport,
        toPatch,
        scope
      }: {
        toImport: number
        toPatch: number
        scope: Scope
      }) => `目錄匯入預覽完成：將匯入 ${countOf(scope, toImport)}，將更新既有 ${toPatch} 個`,
      buildingCollectionsPreview: '正在產生收藏匯入預覽…',
      buildingIndexPreview: '正在產生目錄匯入預覽…',
      buildingRemoteCollectionsPreview: '正在產生遠端收藏預覽…',
      buildingRemoteIndexPreview: '正在產生遠端目錄預覽…',
      remoteCollectionsPreviewCompleted: ({ scope }: { scope: Scope }) =>
        `${SCOPES[scope]}遠端收藏預覽完成`,
      remoteIndexPreviewCompleted: ({ scope }: { scope: Scope }) =>
        `${SCOPES[scope]}目錄遠端預覽完成`
    },

    preview: {
      remoteBadge: ({ scope }: { scope: Scope }) => `${SCOPES[scope]}遠端預覽`,
      createLocalBadge: ({ scope }: { scope: Scope }) => `建立本機${NOUNS[scope]}`,
      updateLocalBadge: ({ scope }: { scope: Scope }) => `更新本機${NOUNS[scope]}`,
      createRemoteCollectionBadge: '建立 Bangumi 收藏',
      updateRemoteCollectionBadge: '更新 Bangumi 收藏',
      collectionStatus: '收藏狀態',
      status: '狀態',
      score: '評分',
      tags: '標籤',
      collection: '合集',
      unitProgress: '閱讀進度',
      unitProgressValue: ({ volumes, chapters }: { volumes: number; chapters: number }) =>
        `${volumes} 卷 / ${chapters} 話`,
      notCollected: '未收藏',
      notRated: '未評分',
      notInCollection: '未加入',
      notSet: '未設定',
      missing: '不存在',
      create: '建立',
      remote: '遠端',
      indexEntry: '目錄條目',
      remotePreview: '遠端預覽'
    },

    status: {
      planned: '計劃中',
      active: '進行中',
      completed: '已完成',
      onHold: '擱置',
      dropped: '拋棄',
      unset: '未設定'
    }
  },

  automations: {
    names: {
      'auth-refresh': 'Bangumi：啟動時重新整理憑證',
      'sync-changed': 'Bangumi：啟動後同步變更佇列',
      'sync-full-daily': 'Bangumi：每日全量同步'
    },
    labels: {
      'auth-refresh': '啟動時重新整理憑證',
      'sync-changed': '啟動後同步變更佇列',
      'sync-full-daily': '每日全量同步'
    },
    descriptions: {
      'auth-refresh': '應用程式啟動時重新整理並驗證 Bangumi 憑證',
      'sync-changed': '應用程式啟動後同步上次執行期間累積的本機變更',
      'sync-full-daily': '每天凌晨執行一次媒體庫全量同步'
    },
    status: {
      missing: '未建立',
      enabled: '已啟用',
      disabled: '已停用'
    }
  },

  settings: {
    commandLabel: '設定',
    commandDescription: '開啟 Bangumi 整合設定',
    webviewTitle: 'Bangumi'
  },

  ui: {
    loading: '正在載入 Bangumi 設定…',
    unavailable: 'Bangumi 設定無法使用',
    saved: '偏好已儲存',
    unsavedChanges: '有未儲存的變更',
    discardChanges: '放棄變更',
    savePreferences: '儲存偏好',
    actionFailed: '操作失敗，請重試',
    mediaScope: '媒體類型',
    mediaScopePlaceholder: '選擇媒體類型',

    tabs: {
      overview: '總覽',
      account: '帳號',
      sync: '同步',
      import: '匯入',
      automation: '自動化',
      maintenance: '維護'
    },

    overview: {
      statusTitle: '狀態總覽',
      accountLabel: '帳號',
      notLoggedIn: '未登入',
      loggedIn: '已登入',
      notAuthorized: '未授權',
      credentialsExpired: '憑證過期',
      available: '可用',
      autoSyncLabel: '自動同步',
      enabled: '已啟用',
      disabled: '未啟用',
      syncItemCreate: '建立收藏',
      syncItemStatus: '遊玩狀態',
      syncItemScore: '評分',
      noSyncItems: '未選擇同步項',
      recommendedAutomations: '推薦自動化',
      automationsComplete: '已全部建立',
      automationsMissing: ({ count }: { count: number }) => `${count} 個未建立`,
      templatesCount: ({ count }: { count: number }) => `${count} 個範本`,
      runtimeTitle: '執行狀態',
      runningJobs: '正在執行的 Bangumi 任務',
      running: '執行中',
      idle: '閒置',
      localResources: '可用本機資源',
      localResourcesSummary: ({
        profiles,
        collections
      }: {
        profiles: number
        collections: number
      }) => `${profiles} 個刮削設定檔 / ${collections} 個合集`,
      quickActionsTitle: '快速入口',
      importAction: '匯入 Bangumi 收藏或目錄',
      maintenanceAction: '調整網路和維護選項',
      automationsTitle: '自動化範本'
    },

    account: {
      sectionTitle: 'Bangumi 帳號',
      loginStatus: '登入狀態',
      verifiedDescription: ({ nickname }: { nickname: string }) => `帳號驗證成功：${nickname}`,
      notLoggedIn: '未登入',
      accessToken: '存取權杖',
      tokenSaved: '已儲存',
      tokenMissing: '未儲存',
      refreshable: '可重新整理',
      expired: '已過期',
      expiresAt: '憑證有效期限',
      actionsTitle: '帳號操作',
      login: '登入 Bangumi',
      verify: '驗證帳號',
      refreshCredentials: '重新整理憑證',
      logout: '登出'
    },

    sync: {
      preferencesTitle: '自動同步偏好',
      autoSync: '自動同步',
      autoSyncDescription: '監聽本機項目建立和使用者狀態欄位變更',
      syncItems: '同步項',
      itemCreate: '建立收藏',
      itemStatus: '項目狀態',
      itemScore: '評分',
      itemUnitProgress: '單元進度',
      clearRemoteScore: '允許刪除遠端評分',
      clearRemoteScoreDescription: '本機評分清空時同時清除 Bangumi 評分',
      manualTitle: '手動同步',
      manualDescription: '立即同步變更佇列，或設定一次全量同步。進度和取消由任務中心處理。',
      syncChangedNow: '立即同步變更',
      fullSync: '全量同步'
    },

    import: {
      noProfilesWarning:
        '目前媒體類型尚未設定刮削設定檔，匯入仍可預覽，但執行本機寫入前需要可用設定檔',
      sourceTitle: '匯入來源',
      sourceDescription: '匯入是一次性任務；選項只用於本次執行，不寫入 Bangumi 偏好',
      myCollections: '我的收藏',
      myCollectionsDescription: '按收藏類型匯入目前 Bangumi 使用者所選媒體類型的收藏',
      bangumiIndex: 'Bangumi 目錄',
      bangumiIndexDescription: '輸入目錄 ID 或連結後設定匯入',
      indexPlaceholder: '目錄 ID 或 https://bgm.tv/index/..',
      configureImport: '設定匯入'
    },

    automation: {
      title: '推薦自動化',
      description: '這裡只建立 Bangumi 推薦範本；啟停、觸發條件和歷史由主應用程式自動化頁面負責',
      create: '建立'
    },

    maintenance: {
      networkTitle: '網路與用戶端',
      networkDescription: '這些偏好儲存後影響後續 Bangumi API 請求',
      loginTimeout: '登入逾時',
      minutes: '分鐘',
      rateLimit: 'API 速率限制',
      rateLimitDescription: '請求數 / 時間視窗',
      seconds: '秒',
      apiTimeout: 'API 逾時',
      retryCount: '重試次數',
      retryUnit: '次',
      debounce: '自動同步防抖',
      notifyErrors: '同步錯誤通知',
      notifyErrorsDescription: '同步任務失敗時傳送主應用程式通知',
      actionsTitle: '維護操作',
      actionsDescription: '這些操作立即生效且無法復原',
      clearSyncState: '清除同步狀態',
      clearSyncStateDescription: '將清空同步指紋與變更佇列，下次同步會重新比對全部條目',
      resetSettings: '還原預設設定',
      resetSettingsDescription: '將把 Bangumi 偏好設定重設為預設值，不會登出帳號或刪除自動化',
      confirmAction: '確認執行'
    },

    fullSync: {
      title: '全量同步',
      syncData: '同步資料',
      itemStatus: '項目狀態',
      itemScore: '評分',
      itemUnitProgress: '單元進度',
      updateExisting: '更新既有收藏',
      updateExistingDescription: '關閉時只為遠端缺少的條目建立 Bangumi 收藏',
      clearRemoteScore: '允許刪除遠端評分',
      batchSize: '批次大小',
      run: '執行同步',
      previewTitle: '全量同步預覽',
      previewDescription: '確認即將同步到 Bangumi 的變更'
    },

    importCollections: {
      title: '匯入我的收藏',
      profile: '刮削設定檔',
      profilePlaceholder: '選擇刮削設定檔',
      collectionTypes: '收藏類型',
      dataItems: '匯入使用者狀態欄位',
      itemStatus: '項目狀態',
      itemScore: '評分',
      itemTags: '標籤',
      itemUnitProgress: '閱讀進度',
      patchExisting: '更新既有條目',
      targetCollection: '加入合集',
      collectionPlaceholder: '選擇合集',
      start: '開始匯入',
      previewTitle: '匯入我的收藏預覽',
      previewDescription: '確認將建立、更新或跳過的條目'
    },

    importIndex: {
      title: '匯入目錄',
      index: '目錄',
      profile: '刮削設定檔',
      profilePlaceholder: '選擇刮削設定檔',
      targetCollection: '目標合集',
      targetNone: '不放入合集',
      targetExisting: '既有合集',
      targetByIndexTitle: '按目錄標題建立',
      selectCollection: '選擇合集',
      collectionPlaceholder: '選擇合集',
      patchExisting: '更新既有條目',
      start: '開始匯入',
      previewTitle: '匯入目錄預覽',
      previewDescription: '確認將建立、更新或跳過的條目'
    },

    previewDialog: {
      empty: '沒有將要變更的條目'
    }
  }
} satisfies typeof en
