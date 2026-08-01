import type { Messages } from '../schema'

/** Scanner: page, items, issues, fix dialog, settings, form, test, and extraction rules. */
export const scanner = {
  title: '掃描器',
  addScanner: '新增掃描器',
  scanAll: '掃描全部',
  cancelAll: '取消全部',
  settingsTooltip: '掃描器設定',
  emptyTitle: '暫無掃描器',
  emptyDescription: '新增掃描器來自動探索並匯入你的媒體檔案。',

  table: {
    name: '名稱',
    type: '類型',
    scraperProfile: '刮削設定檔',
    targetCollection: '目標合集',
    newExisting: '新增 / 已存',
    status: '狀態',
    actions: '操作'
  },

  item: {
    statusIdle: '閒置',
    statusQueued: '排隊中',
    statusScanning: '掃描中',
    statusPausing: '暫停中',
    statusPaused: '已暫停',
    statusCancelling: '取消中',
    statusCompleted: '完成',
    statusCancelled: '已取消',
    statusFailed: '失敗',
    pause: '暫停',
    resume: '繼續',
    scan: '掃描',
    cancel: '取消',
    cancelling: '取消中',
    newCount: ({ count }: { count: number }) => `${count} 新增`,
    existingCount: ({ count }: { count: number }) => `${count} 已存`,
    newCountTooltip: '已加入資料庫的遊戲數',
    existingCountTooltip: '路徑已存在的遊戲數',
    issuesTooltip: ({ count }: { count: number }) => `問題 ${count}`,
    deleteTitle: '確認刪除',
    deleteDescription: ({ name }: { name: string }) =>
      `確定要刪除掃描器「${name}」嗎？此操作無法復原。`
  },

  issueTypes: {
    assetPersistFailed: '資源儲存失敗',
    duplicateExternalId: '外部 ID 重複',
    metadataMissing: '中繼資料缺失',
    pathUnavailable: '路徑無法存取',
    scraperUnavailable: '刮削無法使用',
    unexpectedError: '意外錯誤',
    unsupportedEntry: '不支援的項目'
  },

  issues: {
    title: '掃描問題',
    totalCount: ({ count }: { count: number }) => `共 ${count} 項`,
    searchPlaceholder: '搜尋名稱、路徑、原因…',
    allTypes: '全部類型',
    noMatch: '沒有符合的問題。',
    table: {
      name: '名稱',
      type: '類型',
      path: '路徑',
      reason: '原因',
      relatedGame: '關聯遊戲',
      actions: '操作'
    },
    openPath: '開啟路徑',
    addToExclusion: '加入掃描排除清單',
    fixAndRescrape: '修正並重新刮削',
    alreadyExcluded: '已在排除清單中。',
    addedToExclusion: '已加入掃描排除清單。',
    excludeFailed: '加入排除清單失敗'
  },

  fix: {
    title: '修正掃描結果',
    updateExisting: '更新現有遊戲',
    readdGame: '重新新增遊戲',
    started: '已開始重新刮削。',
    startFailed: '啟動修正失敗',
    unknownError: '未知錯誤',
    rescrape: '重新刮削'
  },

  settings: {
    title: '掃描器設定',
    saved: '設定已儲存。',
    saveFailed: '儲存失敗',
    startAtOpen: '啟動時自動掃描',
    startAtOpenDescription: '開啟應用程式時自動執行所有掃描器。',
    ingestMode: '入庫模式',
    ingestModeDescription: '控制掃描器辨識到新遊戲後的匯入策略。',
    ingestPreferScraper: '優先刮削',
    ingestPreferScraperDescription: '優先使用刮削匯入，失敗時回退到直接入庫。',
    ingestRequireScraper: '必須刮削',
    ingestRequireScraperDescription: '必須透過刮削匯入，刮削失敗時直接記為失敗。',
    ingestDirectOnly: '僅直接入庫',
    ingestDirectOnlyDescription: '跳過刮削，直接依辨識結果建立遊戲。',
    parallelCount: '並行處理數',
    parallelCountDescription: '控制單一掃描器同時處理的項目數，1 表示序列處理。',
    ignoredNames: '忽略名稱清單',
    ignoredNamesDescription: '掃描器會跳過這些提取後的實體名稱。',
    ignoredNamePlaceholder: '輸入要忽略的名稱…',
    noIgnoredNames: '暫無忽略名稱。'
  },

  form: {
    createTitle: '建立掃描器',
    editTitle: '編輯掃描器',
    requiredFields: '請填寫必填欄位。',
    updated: '掃描器已更新。',
    created: '掃描器已建立。',
    updateFailed: '更新失敗，請重試。',
    createFailed: '建立失敗，請重試。',
    openLinkFailed: '開啟連結失敗',
    name: '名稱',
    namePlaceholder: '例如：我的遊戲庫',
    type: '類型',
    scanPath: '掃描路徑',
    scanPathPlaceholder: '選擇要掃描的資料夾',
    entityDepth: '實體層級',
    entityDepthHelp:
      '指定媒體實體在目錄結構中的層級深度。0 表示掃描路徑的直接子項就是實體，1 表示子目錄下的項目是實體，以此類推。',
    scraperProfile: '刮削設定檔',
    scraperProfileHelp:
      '選擇用於取得中繼資料的刮削設定檔。設定檔決定從哪些資料來源取得哪些欄位的資料。',
    targetCollection: '目標合集',
    scanInterval: '自動掃描間隔',
    scanIntervalDescription: '設定為 0 表示不自動掃描。',
    minutes: '分鐘',
    nameExtractionRules: '名稱提取規則',
    nameExtractionRulesHelp:
      '依序套用正規表示式規則，從資料夾名稱中提取遊戲名稱。規則使用具名擷取群組 (?<name>...) 提取名稱。',
    nameExtractionRulesLink: '檢視具名擷取群組文件',
    editRules: '編輯規則',
    notConfigured: '未設定',
    ruleCount: ({ count }: { count: number }) => `${count} 條`,
    testConfig: '測試設定'
  },

  test: {
    title: '掃描器設定測試',
    depth: '層級',
    rules: '規則',
    entities: '實體',
    matched: '符合',
    noEntitiesFound: '在指定層級未找到實體。',
    allExcluded: '所有實體已被排除。',
    entityName: '實體名稱',
    extractedName: '提取後名稱',
    rule: '規則',
    addToExclusion: '加入排除清單'
  },

  rules: {
    title: '名稱提取規則',
    empty: '暫無規則，點選下方按鈕新增。',
    unnamedRule: '（未命名規則）',
    addRule: '新增規則',
    selectPresets: '選擇預設',
    itemAddTitle: '新增規則',
    itemEditTitle: '編輯規則',
    description: '描述',
    descriptionPlaceholder: '例如：移除方括號前綴',
    pattern: '正規表示式',
    patternHintBefore: '使用具名擷取群組',
    patternHintAfter: '來指定要提取的名稱。',
    presetsTitle: '選擇預設規則',
    presetsAllAdded: '所有預設規則已新增。',
    addWithCount: ({ count }: { count: number }) => `新增 (${count})`,
    presets: {
      bracketPrefix: { name: '方括號前綴 [xxx]', description: '移除開頭的 [xxx]' },
      parenPrefix: { name: '圓括號前綴 (xxx)', description: '移除開頭的 (xxx)' },
      multiBracketPrefix: { name: '多重方括號前綴', description: '移除多個連續 [xxx]' },
      bracketSuffix: { name: '方括號後綴 [xxx]', description: '移除結尾的 [xxx]' },
      parenSuffix: { name: '圓括號後綴 (xxx)', description: '移除結尾的 (xxx)' },
      versionSuffix: { name: '版本號後綴 _vX.X', description: '移除 _v1.2.3' },
      yearSuffix: { name: '年份後綴 (YYYY)', description: '移除 (2024)' },
      langSuffix: { name: '語言後綴', description: '移除 CHS/CHT/JP/EN 等' },
      bracketBoth: { name: '前後方括號', description: '移除 [前綴] 和 [後綴]' }
    }
  },

  run: {
    title: ({ name }: { name: string }) => `掃描 ${name}`,
    preparing: '準備掃描',
    discovering: '正在掃描目錄',
    processing: '正在處理掃描結果',
    finished: '掃描完成',
    resultCompleted: '掃描完成',
    resultCancelled: '掃描已取消',
    resultFailed: '掃描失敗',
    resultSummary: ({
      status,
      processed,
      total,
      added,
      existing,
      failed,
      issues
    }: {
      status: string
      processed: number
      total: number
      added: number
      existing: number
      failed: number
      issues: number
    }) =>
      `${status}：處理 ${processed}/${total}，新增 ${added}，已存在 ${existing}，失敗 ${failed}，問題 ${issues}`,
    reasons: {
      scrapeUnavailableRequired: '刮削設定不可用，目前模式要求刮削，未新增。',
      noMetadataRequired: '未找到可用中繼資料，目前模式要求刮削，未新增。',
      scrapeFailedRequired: '刮削失敗且目前模式要求刮削，未新增。',
      scrapeUnavailableFallback: '刮削設定不可用，已使用目錄名直接新增。',
      noMetadataFallback: '未找到可用中繼資料，已使用目錄名直接新增。',
      scrapeFailedFallback: '刮削失敗，已使用目錄名直接新增。',
      pathInaccessible: ({ message }: { message: string }) => `路徑無法存取，未新增：${message}`,
      notScannableDirectory: '路徑不是可掃描目錄，未新增。',
      externalIdLinked: '外部 ID 已關聯到現有遊戲，目前路徑未新增。'
    }
  }
} satisfies Messages['scanner']
