import type { Messages } from '../schema'

/** Scanner: page, items, issues, fix dialog, settings, form, test, and extraction rules. */
export const scanner = {
  title: '扫描器',
  addScanner: '添加扫描器',
  scanAll: '扫描全部',
  cancelAll: '取消全部',
  settingsTooltip: '扫描器设置',
  emptyTitle: '暂无扫描器',
  emptyDescription: '添加扫描器来自动发现并导入你的媒体文件',

  table: {
    name: '名称',
    type: '类型',
    scraperProfile: '刮削配置',
    targetCollection: '目标合集',
    newExisting: '新增 / 已存',
    status: '状态',
    actions: '操作'
  },

  item: {
    statusIdle: '空闲',
    statusQueued: '排队中',
    statusScanning: '扫描中',
    statusPausing: '暂停中',
    statusPaused: '已暂停',
    statusCancelling: '取消中',
    statusCompleted: '完成',
    statusCancelled: '已取消',
    statusFailed: '失败',
    pause: '暂停',
    resume: '继续',
    scan: '扫描',
    cancel: '取消',
    cancelling: '取消中',
    watching: '正在监控变更',
    watchDisabled: '仅手动扫描',
    newCount: ({ count }: { count: number }) => `${count} 新增`,
    existingCount: ({ count }: { count: number }) => `${count} 已存`,
    newCountTooltip: '已添加到数据库的游戏数',
    existingCountTooltip: '路径已存在的游戏数',
    issuesTooltip: ({ count }: { count: number }) => `问题 ${count}`,
    deleteTitle: '确认删除',
    deleteDescription: ({ name }: { name: string }) =>
      `确定要删除扫描器「${name}」吗？此操作无法撤销。`
  },

  issueTypes: {
    assetPersistFailed: '资源保存失败',
    duplicateExternalId: '外部 ID 重复',
    fileSyncFailed: '文件同步失败',
    metadataMissing: '元数据缺失',
    pathUnavailable: '路径不可访问',
    scraperUnavailable: '刮削不可用',
    unexpectedError: '意外错误',
    unsupportedEntry: '不支持的条目'
  },

  issues: {
    title: '扫描问题',
    totalCount: ({ count }: { count: number }) => `共 ${count} 项`,
    searchPlaceholder: '搜索名称、路径、原因…',
    allTypes: '全部类型',
    noMatch: '没有匹配的问题',
    table: {
      name: '名称',
      type: '类型',
      path: '路径',
      reason: '原因',
      relatedEntity: '关联条目',
      actions: '操作'
    },
    openPath: '打开路径',
    addToExclusion: '加入扫描排除列表',
    fixAndRescrape: '修正并重新刮削',
    alreadyExcluded: '已在排除列表中',
    addedToExclusion: '已加入扫描排除列表',
    excludeFailed: '加入排除列表失败'
  },

  fix: {
    title: '修正扫描结果',
    updateExisting: '更新现有条目',
    readd: '重新添加条目',
    started: '已开始重新刮削',
    startFailed: '启动修正失败',
    unknownError: '未知错误',
    rescrape: '重新刮削'
  },

  settings: {
    title: '扫描器设置',
    saved: '设置已保存',
    saveFailed: '保存失败',
    ingestMode: '入库模式',
    ingestModeDescription: '控制扫描器识别到新游戏后的导入策略',
    ingestPreferScraper: '优先刮削',
    ingestPreferScraperDescription: '优先使用刮削导入，失败时回退到直接入库',
    ingestRequireScraper: '必须刮削',
    ingestRequireScraperDescription: '必须通过刮削导入，刮削失败时直接记为失败',
    ingestDirectOnly: '仅直接入库',
    ingestDirectOnlyDescription: '跳过刮削，直接按识别结果创建游戏',
    parallelCount: '并行处理数',
    parallelCountDescription: '所有进行中的扫描共享的同时处理条目总数，1 表示串行处理',
    ignoredNames: '忽略名称列表',
    ignoredNamesDescription: '扫描器会跳过这些提取后的实体名称',
    ignoredNamePlaceholder: '输入要忽略的名称…',
    noIgnoredNames: '暂无忽略名称'
  },

  form: {
    createTitle: '创建扫描器',
    editTitle: '编辑扫描器',
    requiredFields: '请填写名称和扫描路径',
    updated: '扫描器已更新',
    created: '扫描器已创建',
    updateFailed: '更新失败，请重试',
    createFailed: '创建失败，请重试',
    openLinkFailed: '打开链接失败',
    name: '名称',
    namePlaceholder: '例如：我的游戏库',
    type: '类型',
    scanPath: '扫描路径',
    scanPathPlaceholder: '选择要扫描的文件夹',
    entityDepth: '实体层级',
    entityDepthHelp:
      '指定媒体实体在目录结构中的层级深度。0 表示扫描路径的直接子项就是实体，1 表示子目录下的项目是实体，以此类推。',
    scraperProfile: '刮削配置',
    scraperProfileHelp:
      '选择用于获取元数据的刮削配置。配置决定了从哪些数据源获取哪些字段的数据。不选择时，此扫描器直接按文件夹名导入条目。',
    targetCollection: '目标合集',
    watchEnabled: '监控变更',
    watchEnabledDescription: '出现新的实体目录时自动扫描，并在启动时扫描一次。关闭后仅能手动扫描。',
    nameExtractionRules: '名称提取规则',
    nameExtractionRulesHelp:
      '按顺序应用正则表达式规则，从文件夹名中提取游戏名称。规则使用命名捕获组 (?<name>...) 提取名称。',
    nameExtractionRulesLink: '查看命名捕获组文档',
    editRules: '编辑规则',
    notConfigured: '未配置',
    ruleCount: ({ count }: { count: number }) => `${count} 条`,
    testConfig: '测试配置'
  },

  test: {
    title: '扫描器配置测试',
    depth: '层级',
    rules: '规则',
    entities: '实体',
    matched: '匹配',
    noEntitiesFound: '在指定层级未找到实体',
    allExcluded: '所有实体已被排除',
    entityName: '实体名称',
    extractedName: '提取后名称',
    rule: '规则',
    addToExclusion: '添加到排除列表'
  },

  rules: {
    title: '名称提取规则',
    empty: '暂无规则，点击下方按钮添加',
    unnamedRule: '（未命名规则）',
    addRule: '添加规则',
    selectPresets: '选择预设',
    itemAddTitle: '添加规则',
    itemEditTitle: '编辑规则',
    description: '描述',
    descriptionPlaceholder: '例如：移除方括号前缀',
    pattern: '正则表达式',
    patternHintBefore: '使用命名捕获组',
    patternHintAfter: '来指定要提取的名称',
    presetsTitle: '选择预设规则',
    presetsAllAdded: '所有预设规则已添加',
    addWithCount: ({ count }: { count: number }) => `添加 (${count})`,
    presets: {
      bracketPrefix: { name: '方括号前缀 [xxx]', description: '移除开头的 [xxx]' },
      parenPrefix: { name: '圆括号前缀 (xxx)', description: '移除开头的 (xxx)' },
      multiBracketPrefix: { name: '多重方括号前缀', description: '移除多个连续 [xxx]' },
      bracketSuffix: { name: '方括号后缀 [xxx]', description: '移除结尾的 [xxx]' },
      parenSuffix: { name: '圆括号后缀 (xxx)', description: '移除结尾的 (xxx)' },
      versionSuffix: { name: '版本号后缀 _vX.X', description: '移除 _v1.2.3' },
      yearSuffix: { name: '年份后缀 (YYYY)', description: '移除 (2024)' },
      langSuffix: { name: '语言后缀', description: '移除 CHS/CHT/JP/EN 等' },
      bracketBoth: { name: '前后方括号', description: '移除 [前缀] 和 [后缀]' }
    }
  },

  run: {
    title: ({ name }: { name: string }) => `扫描 ${name}`,
    preparing: '准备扫描',
    discovering: '正在扫描目录',
    processing: '正在处理扫描结果',
    finished: '扫描完成',
    resultCompleted: '扫描完成',
    resultCancelled: '扫描已取消',
    resultFailed: '扫描失败',
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
      `${status}：处理 ${processed}/${total}，新增 ${added}，已存在 ${existing}，失败 ${failed}，问题 ${issues}`,
    reasons: {
      scrapeUnavailableRequired: '刮削配置不可用，当前模式要求刮削，未添加',
      noMetadataRequired: '未找到可用元数据，当前模式要求刮削，未添加',
      scrapeFailedRequired: '刮削失败且当前模式要求刮削，未添加',
      scrapeUnavailableFallback: '刮削配置不可用，已使用目录名直接添加',
      noMetadataFallback: '未找到可用元数据，已使用目录名直接添加',
      scrapeFailedFallback: '刮削失败，已使用目录名直接添加',
      pathInaccessible: ({ message }: { message: string }) => `路径不可访问，未添加：${message}`,
      notScannableDirectory: '路径不是可扫描目录，未添加',
      externalIdLinked: '外部 ID 已关联到现有条目，当前路径未添加',
      episodeNumbersUnreadable: ({ count }: { count: number }) =>
        `${count} 个视频文件无法识别话数，已作为未编号剧集添加`,
      unitNumbersUnreadable: ({ count }: { count: number }) =>
        `${count} 个文件无法识别卷号或话数，已作为未编号单元添加`,
      volumeNumbersUnreadable: ({ count }: { count: number }) =>
        `${count} 个书籍文件无法识别卷号，已作为未编号卷添加`,
      fileSyncFailed: '条目已添加，但视频文件同步失败，详见日志',
      unexpected: '处理此条目时发生意外错误，详见日志'
    }
  }
} satisfies Messages['scanner']
