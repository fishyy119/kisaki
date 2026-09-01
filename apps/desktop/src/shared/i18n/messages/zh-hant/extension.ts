import type { Messages } from '../schema'

type ReleaseActionKind = 'install' | 'update' | 'reinstall' | 'downgrade'

const RELEASE_ACTIONS: Record<ReleaseActionKind, string> = {
  install: '安裝',
  update: '更新',
  reinstall: '重新安裝',
  downgrade: '降級'
}

/** Extension platform surfaces: manager pages, panels, dialogs, and webviews. */
export const extension = {
  title: '擴充功能',
  webviewPageClosed: '該擴充功能頁面已關閉',

  categories: {
    scraper: '中繼資料',
    tool: '工具',
    theme: '主題',
    integration: '整合',
    uncategorized: '未分類',
    joinSeparator: '、'
  },

  nav: {
    discover: '探索',
    installed: '已安裝',
    repositories: '儲存庫',
    signers: '簽章'
  },

  header: {
    reloadPending: ({ count }: { count: number }) =>
      `擴充功能程式碼已更新（${count}），點選重載處理程序以套用`,
    reloadHost: '重載擴充功能處理程序',
    reloadProcess: '重載處理程序',
    install: '安裝擴充功能'
  },

  host: {
    reloading: '正在重載擴充功能處理程序',
    reloaded: '擴充功能處理程序已重載',
    reloadFailed: '重載擴充功能處理程序失敗',
    codeUpdatedTitle: '擴充功能程式碼已更新',
    pendingChanges: ({ subject }: { subject: string }) => `${subject}有未套用的修改`,
    subjectSingle: ({ id }: { id: string }) => `擴充功能 ${id}`,
    subjectMultiple: ({ count }: { count: number }) => `${count} 個擴充功能`
  },

  entityMenu: {
    loading: '正在載入擴充功能選單…',
    loadFailed: '擴充功能選單載入失敗',
    partiallyUnavailable: '部分擴充功能選單無法使用',
    actionFailed: '擴充功能選單操作失敗'
  },

  actions: {
    install: '安裝',
    update: '更新',
    reinstall: '重新安裝',
    downgrade: '降級',
    apply: '套用'
  },

  release: {
    actionTitle: ({ action }: { action: string }) => `${action}擴充功能`,
    prepareTitle: '準備擴充功能版本',
    importLocalTitle: '匯入本機擴充功能',
    repositoryDescription: '檢查版本、儲存庫來源和簽章後繼續',
    localDescription: '選擇本機 .kisx 檔案並確認',
    confirmAction: ({ action }: { action: string }) => `確認${action}`,
    selectFile: '選擇檔案',
    planFailed: '無法建立版本計畫',
    filePickerTitle: '選擇擴充功能檔案',
    filePickerFilterName: '擴充功能套件',
    cancelled: '操作已取消',
    applied: ({ action }: { action: string }) => `擴充功能${action}成功`,
    applyFailed: '操作失敗',
    signerTrusted: '簽章已信任',
    signerUntrusted: '簽章未信任',
    signerChanged: '簽章已變更',
    signerUnsigned: '未簽章',
    kindStable: '穩定版',
    kindPreview: '預覽版',
    unknownSize: '未知大小',
    repositoryLine: ({ name }: { name: string }) => `儲存庫：${name}`,
    localFileLine: ({ size }: { size: string }) => `本機檔案 · ${size}`,
    currentVersion: '目前版本',
    notInstalled: '未安裝',
    releaseKind: '版本類型',
    signerFingerprint: '簽章指紋',
    artifactSize: '安裝套件大小',
    changelog: '更新日誌',
    viewChangelog: '檢視',
    needsConfirmation: '需要確認',
    enableAfterApply: '套用後啟用',
    updatePolicy: '更新策略',
    trustSigner: '信任此擴充功能的簽章指紋',
    pickLocalHint: '選擇本機擴充功能套件檔案（.kisx）'
  },

  policy: {
    manual: '手動',
    auto: '自動',
    pinned: '鎖定'
  },

  installer: {
    releaseTitle: ({ action, name }: { action: ReleaseActionKind; name: string }) =>
      `${RELEASE_ACTIONS[action]}擴充功能 ${name}`,
    localTitle: '套用本機擴充功能套件',
    completedTitle: ({ action }: { action: ReleaseActionKind }) =>
      `${RELEASE_ACTIONS[action]}擴充功能完成`,
    completedSummary: ({
      action,
      name,
      version
    }: {
      action: ReleaseActionKind
      name: string
      version: string
    }) => `已${RELEASE_ACTIONS[action]} ${name} v${version}`,
    cancelledSummary: ({ action }: { action: ReleaseActionKind }) =>
      `擴充功能${RELEASE_ACTIONS[action]}已取消`,
    localCancelledSummary: '擴充功能套件套用已取消',
    phases: {
      waitLock: '等待擴充功能套件寫入鎖',
      prepare: '準備擴充功能安裝套件',
      verify: '驗證擴充功能安裝套件',
      extract: '解壓縮擴充功能安裝套件',
      commit: '提交擴充功能安裝狀態'
    }
  },

  repositoryRefresh: {
    refreshOneTitle: ({ name }: { name: string }) => `重新整理儲存庫 ${name}`,
    refreshAllTitle: '重新整理全部擴充功能儲存庫',
    allSubjectLabel: '全部擴充功能儲存庫',
    cancelledSummary: '擴充功能儲存庫重新整理已取消',
    preparing: '準備重新整理擴充功能儲存庫',
    noneEnabled: '沒有啟用的擴充功能儲存庫',
    refreshingOne: ({ name }: { name: string }) => `正在重新整理 ${name}`,
    refreshedOne: ({ name }: { name: string }) => `已重新整理 ${name}`,
    oneFailedTitle: '儲存庫重新整理失敗',
    oneFailedSummary: ({ name }: { name: string }) => `${name} 重新整理失敗`,
    oneNotModifiedTitle: '儲存庫未變更',
    oneCompletedTitle: '儲存庫重新整理完成',
    oneNotModifiedSummary: ({ name }: { name: string }) => `${name} 已是最新`,
    oneRefreshedSummary: ({ name }: { name: string }) => `${name} 已重新整理`,
    allFailedTitle: '擴充功能儲存庫重新整理失敗',
    allPartialTitle: '部分擴充功能儲存庫重新整理失敗',
    allCompletedTitle: '擴充功能儲存庫重新整理完成',
    noneEnabledSummary: '沒有啟用的擴充功能儲存庫',
    allSummary: ({
      processed,
      total,
      succeeded,
      notModified,
      failed
    }: {
      processed: number
      total: number
      succeeded: number
      notModified: number
      failed: number
    }) =>
      `已處理 ${processed}/${total} 個儲存庫，成功 ${succeeded}，未變更 ${notModified}，失敗 ${failed}`
  },

  updatePolicyDialog: {
    title: '更新設定',
    policyLabel: '更新策略',
    receivePrerelease: '接收預覽版更新',
    saved: '更新設定已儲存',
    saveFailed: '儲存更新設定失敗'
  },

  uninstall: {
    title: ({ name }: { name: string }) => `解除安裝 ${name}？`,
    purgeData: '同時清除擴充功能資料',
    confirmPurge: '解除安裝並清除',
    confirm: '解除安裝',
    uninstalledPurged: '擴充功能已解除安裝並清除資料',
    uninstalled: '擴充功能已解除安裝',
    purgeFailed: '擴充功能已解除安裝，清除資料失敗',
    failed: '解除安裝失敗'
  },

  discover: {
    emptyTitle: '未找到擴充功能',
    emptyCategoryDescription: '該分類下暫無可用擴充功能',
    emptyDescription: '暫無可用擴充功能',
    loadMore: '載入更多',
    sortRelevance: '相關',
    sortName: '名稱',
    sortPublishedAt: '發佈',
    sortUpdatedAt: '更新',
    sortRepositoryPriority: '儲存庫',
    searchPlaceholder: '搜尋擴充功能名稱或描述…',
    allRepositories: '全部儲存庫',
    compatibleOnly: '僅顯示相容版本',
    allCompatibility: '顯示全部相容狀態',
    allCategories: '全部',
    unknownAuthor: '未知作者',
    sourceCount: ({ count }: { count: number }) => `${count} 個來源`,
    noVersion: '無版本',
    noDescription: '無描述',
    homepage: '首頁',
    details: '詳細資訊',
    installed: '已安裝',
    install: '安裝',
    unknownTime: '未知時間',
    unknownSize: '未知大小',
    extensionId: '擴充功能 ID',
    author: '作者',
    latestPublish: '最近發佈',
    codeRepository: '程式碼儲存庫',
    versions: '版本',
    latestBadge: '最新版',
    previewBadge: '預覽版',
    yankedBadge: '已撤回',
    apiIncompatibleBadge: 'API 不相容',
    noArtifactBadge: '無可用套件',
    unsignedBadge: '未簽章',
    sourcesLine: ({ value }: { value: string }) => `來源：${value}`,
    publishedLine: ({ value }: { value: string }) => `發佈時間：${value}`,
    apiLine: ({ value }: { value: string }) => `擴充功能 API：${value}`,
    sizeLine: ({ value }: { value: string }) => `安裝套件大小：${value}`
  },

  installed: {
    filterAll: '全部',
    filterEnabled: '已啟用',
    filterDisabled: '已停用',
    sortName: '名稱',
    sortStatus: '狀態',
    sortHasUpdate: '更新',
    startupUpdating: '啟動更新中',
    repositoryRefreshFailed: '儲存庫重新整理失敗',
    autoUpdateFailedCount: ({ count }: { count: number }) => `${count} 個自動更新失敗`,
    searchPlaceholder: '搜尋已安裝的擴充功能…',
    checkUpdates: '檢查更新',
    showAll: '顯示全部',
    showUpdatesOnly: '僅顯示有更新',
    updatesAvailable: '發現可用更新',
    updatesAvailableCount: ({ count }: { count: number }) => `${count} 個擴充功能可以更新`,
    noUpdates: '暫無可用更新',
    checkUpdatesFailed: '檢查更新失敗',
    emptyTitle: '暫無已安裝的擴充功能',
    emptyDescription: '從「探索」頁面安裝擴充功能',
    noMatchTitle: '沒有符合的擴充功能',
    noMatchDescription: '嘗試調整篩選條件',

    unknownVersion: '未知版本',
    statusReady: '正常',
    statusInvalid: '套件無效',
    statusMissingPackage: '套件缺失',
    runtimeLoading: '載入中',
    runtimeRunning: '執行中',
    runtimeFailed: '載入失敗',
    runtimeStopped: '未執行',
    builtinManaged: '內建擴充功能由 Kisaki 管理',
    enableFailed: '無法啟用擴充功能',
    packageNotRunnable: '擴充功能套件目前無法執行',
    enabledFeedback: '擴充功能已啟用',
    disabledFeedback: '擴充功能已停用',
    operationFailed: '操作失敗',
    extensionOperationFailed: '擴充功能操作失敗',
    builtinBadge: '內建',
    updateBadge: '更新',
    unknownAuthor: '未知',
    noDescription: '無描述',
    enableWithApp: '隨應用程式啟用',
    enabledState: '啟用',
    disabledState: '停用',
    update: '更新',
    detailsTooltip: '詳細資訊',
    updatePolicyTooltip: '更新設定',
    uninstallTooltip: '解除安裝',

    details: {
      basicInfo: '基本資訊',
      extensionId: '擴充功能 ID',
      version: '版本',
      author: '作者',
      unknownAuthor: '未知作者',
      category: '類別',
      installedAt: '安裝時間',
      homepage: '首頁',
      status: '狀態',
      enabledStatus: '啟用狀態',
      enabled: '已啟用',
      disabled: '已停用',
      packageStatus: '套件狀態',
      runtimeStatus: '執行狀態',
      runtimeError: '執行錯誤',
      installationSource: '安裝來源',
      sourceType: '類型',
      sourceBuiltin: '內建擴充功能',
      sourceRepository: '儲存庫安裝',
      sourceLocalFile: '本機檔案',
      sourceUnknown: '未知來源',
      repository: '儲存庫',
      repositoryUrl: '儲存庫位址',
      releaseDigest: '發佈摘要',
      manifestDigest: '資訊清單摘要',
      artifactSha256: '安裝套件 SHA256',
      signerFingerprint: '簽章指紋',
      releaseVersion: '發佈版本',
      publishedAt: '發佈時間',
      extensionApi: '擴充功能 API',
      file: '檔案',
      installDir: '安裝目錄',
      updateConfig: '更新設定',
      updatePolicy: '更新策略',
      pinnedVersion: '鎖定版本',
      receivePrerelease: '接收預覽版更新',
      packageIssues: '套件問題',
      runtimeDiagnostics: '執行診斷',
      unknownTime: '未知時間',
      severityInfo: '資訊',
      severityWarning: '警告',
      severityError: '錯誤'
    }
  },

  repository: {
    none: '無',
    stateEnabled: '已啟用',
    stateDisabled: '已停用',
    healthDisabled: '已停用',
    healthError: '異常',
    healthNeverRefreshed: '未重新整理',
    healthOk: '正常',
    added: '儲存庫已新增',
    addFailed: '新增儲存庫失敗',
    officialAdded: '官方儲存庫已新增',
    officialAddFailed: '新增官方儲存庫失敗',
    refreshAllStarted: '已開始重新整理擴充功能儲存庫',
    refreshFailed: '重新整理儲存庫失敗',
    refreshStarted: '已開始重新整理儲存庫',
    enabledFeedback: '儲存庫已啟用',
    disabledFeedback: '儲存庫已停用',
    deleted: '儲存庫已刪除',
    operationFailed: '儲存庫操作失敗',
    refreshAll: '重新整理全部',
    addOfficial: '新增官方儲存庫',
    add: '新增儲存庫',
    emptyTitle: '暫無擴充功能儲存庫',
    priorityLine: ({ value }: { value: string }) => `優先順序：${value}`,
    packageCountLine: ({ count }: { count: number }) => `擴充功能套件：${count}`,
    manifestUpdatedLine: ({ value }: { value: string }) => `資訊清單更新：${value}`,
    lastCheckedLine: ({ value }: { value: string }) => `上次檢查：${value}`,
    detailsTooltip: '詳細資訊',

    addDialog: {
      title: '新增擴充功能儲存庫',
      manifestUrl: '儲存庫資訊清單 URL',
      displayName: '顯示名稱',
      displayNamePlaceholder: '留空使用資訊清單名稱'
    },

    removeDialog: {
      title: ({ name }: { name: string }) => `刪除 ${name}？`,
      description:
        '確定要刪除該儲存庫嗎？刪除後將不再從該儲存庫取得擴充功能目錄，已安裝的擴充功能不會被解除安裝。',
      deleting: '刪除中'
    },

    details: {
      basicInfo: '基本資訊',
      repositoryId: '儲存庫 ID',
      priority: '優先順序',
      packages: '擴充功能套件',
      localState: '本機狀態',
      manifestUrl: '儲存庫資訊清單 URL',
      manifestMetadata: '資訊清單中繼資料',
      manifestDigest: '資訊清單摘要',
      manifestUpdatedAt: '資訊清單更新時間',
      refreshState: '重新整理狀態',
      lastChecked: '上次檢查',
      lastSuccess: '上次成功',
      lastError: '最近錯誤',
      localRecord: '本機記錄',
      createdAt: '建立時間',
      updatedAt: '更新時間'
    }
  },

  signer: {
    none: '無',
    localConfirmation: '本機確認',
    revoked: '簽章信任已撤銷',
    revokeFailed: '撤銷簽章信任失敗',
    emptyTitle: '暫無信任的簽章指紋',
    sourceLine: ({ value }: { value: string }) => `來源：${value}`,
    trustedAtLine: ({ value }: { value: string }) => `信任時間：${value}`,
    viewDetails: '檢視詳細資訊',
    revokeTrust: '撤銷信任',

    removeDialog: {
      title: '撤銷簽章信任？',
      description: ({ id }: { id: string }) =>
        `確定要撤銷「${id}」的簽章信任嗎？新版本使用該指紋時將需要重新確認。`,
      revoking: '撤銷中',
      revoke: '撤銷'
    },

    details: {
      title: '簽章詳細資訊',
      extensionId: '擴充功能 ID',
      algorithm: '演算法',
      keyId: '金鑰 ID',
      fingerprint: '簽章指紋',
      publicKey: '公開金鑰',
      trustRecordId: '信任記錄 ID',
      sourceRepositoryId: '來源儲存庫 ID',
      sourceRepositoryUrl: '來源儲存庫 URL',
      trustedAt: '信任時間',
      createdAt: '建立時間'
    }
  }
} satisfies Messages['extension']
