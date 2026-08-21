import type { Messages } from '../schema'

/** Task center: run list, controls, details, and task-run display vocabulary. */
export const task = {
  center: '任务中心',
  tabActive: '进行中',
  tabCompleted: '已完成',
  noActiveTasks: '暂无进行中的任务',
  noCompletedRecords: '暂无完成记录',

  table: {
    task: '任务',
    progress: '进度',
    result: '结果',
    status: '状态',
    actions: '操作'
  },

  toolbar: {
    searchActivePlaceholder: '搜索进行中的任务…',
    searchCompletedPlaceholder: '搜索完成记录…',
    refreshing: '刷新中…',
    allCategories: '全部分类',
    allStatuses: '全部状态',
    refresh: '刷新',
    refreshList: '刷新任务列表',
    clearCompleted: '清理完成记录'
  },

  feedback: {
    refreshFailed: '刷新任务中心失败',
    clearFailed: '清理任务记录失败',
    deleteFailed: '删除任务记录失败',
    pauseFailed: '暂停任务失败',
    resumeFailed: '继续任务失败',
    cancelFailed: '取消任务失败',
    cannotPauseNow: '任务暂时不能暂停。',
    cannotResumeNow: '任务暂时不能继续。',
    cannotCancel: '任务已结束或不可取消。'
  },

  row: {
    pause: '暂停',
    pauseTask: '暂停任务',
    resume: '继续',
    resumeTask: '继续任务',
    cancel: '取消',
    cancelTask: '取消任务',
    details: '详情',
    viewDetails: '查看详情',
    deleteRecord: '删除记录',
    duration: '耗时',
    counters: '计数',
    warningCount: ({ count }: { count: number }) => `${count} 条警告`,
    moreWarnings: ({ count }: { count: number }) => `还有 ${count} 条警告`
  },

  progress: {
    progress: '进度',
    rate: '速度',
    eta: '剩余',
    inProgress: '进行中',
    etaAbout: ({ duration }: { duration: string }) => `约 ${duration}`
  },

  details: {
    runId: '任务 ID',
    category: '分类',
    operation: '操作',
    operationId: '操作 ID',
    owner: '来源',
    initiator: '发起',
    subject: '对象',
    createdAt: '创建',
    startedAt: '开始',
    finishedAt: '结束',
    duration: '耗时',
    warnings: '警告',
    info: '信息',
    description: '描述',
    result: '结果',
    output: '输出',
    noResultSummary: '无结果摘要'
  },

  categories: {
    scanner: '扫描',
    ingest: '导入',
    extension: '扩展',
    updater: '更新',
    system: '系统'
  },

  statuses: {
    queued: '排队中',
    running: '运行中',
    pausing: '暂停中',
    paused: '已暂停',
    cancelling: '取消中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  },

  counters: {
    total: '总数',
    processed: '已处理',
    succeeded: '成功',
    failed: '失败',
    skipped: '跳过',
    warnings: '警告',
    added: '新增',
    existing: '已存在',
    updated: '更新',
    deleted: '删除',
    changed: '变化',
    notModified: '未变化'
  },

  subjects: {
    command: '命令',
    automation: '自动化',
    scanner: '扫描器',
    game: '游戏',
    anime: '动漫',
    person: '人物',
    company: '公司',
    character: '角色',
    extension: '扩展',
    repository: '仓库',
    app: '应用'
  },
  subjectValue: ({ label, value }: { label: string; value: string }) => `${label}：${value}`,

  operations: {
    scan: '扫描媒体',
    installExtension: '安装扩展',
    updateExtension: '更新扩展',
    importExtensionPackage: '导入扩展包',
    uninstallExtension: '卸载扩展',
    refreshRepository: '刷新扩展仓库',
    refreshAllRepositories: '刷新全部扩展仓库',
    checkUpdates: '检查软件更新',
    downloadUpdate: '下载软件更新',
    systemMaintenance: '系统维护',
    extensionTask: '扩展任务',
    ingestAdd: ({ label }: { label: string }) => `添加${label}`,
    ingestUpdate: ({ label }: { label: string }) => `更新${label}`,
    ingestBatchAdd: ({ label }: { label: string }) => `批量添加${label}`,
    ingestBatchUpdate: ({ label }: { label: string }) => `批量更新${label}`,
    ingestBatchDelete: ({ label }: { label: string }) => `批量删除${label}`,
    ingestFallbackEntity: '条目'
  },

  owner: {
    app: '应用',
    extension: ({ name }: { name: string }) => `扩展：${name}`
  },

  initiator: {
    user: '用户',
    automation: ({ name }: { name: string }) => `自动化：${name}`,
    extension: ({ name }: { name: string }) => `扩展：${name}`,
    system: '系统',
    systemWithReason: ({ reason }: { reason: string }) => `系统：${reason}`
  },

  systemReasons: {
    startup: '启动',
    maintenance: '维护',
    update: '更新',
    shutdown: '退出'
  },

  progressUnits: {
    item: '项',
    file: '文件',
    byte: '字节',
    entity: '项',
    step: '步骤',
    package: '包',
    request: '请求'
  },

  ratePeriods: {
    second: '秒',
    minute: '分钟',
    hour: '小时'
  },

  notifications: {
    cancelling: '正在取消…',
    pausing: '正在暂停…',
    paused: '已暂停',
    cancelUnavailable: '任务已结束或不可取消。',
    finalCompleted: ({ title }: { title: string }) => `${title}已完成`,
    finalCancelled: ({ title }: { title: string }) => `${title}已取消`,
    finalFailed: ({ title }: { title: string }) => `${title}失败`
  }
} satisfies Messages['task']
