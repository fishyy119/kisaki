import type { Messages } from '../schema'

/** Automation: page, toolbar, rows, form dialog, details dialog, and run history. */
export const automation = {
  title: '自动化',
  addAutomation: '添加自动化',

  display: {
    onStartup: '启动时',
    manualOnly: '手动运行',
    triggerSeparator: '，',
    systemTimezone: '系统时区',
    noRetry: '不重试',
    retryTimes: ({ count }: { count: number }) => `重试 ${count} 次`,
    pauseAfterFailure: '失败后暂停',
    pauseAfterFailureWithRetry: ({ count }: { count: number }) => `失败后暂停，先重试 ${count} 次`,
    never: '从未',
    statusCompleted: '完成',
    statusFailed: '失败',
    triggerManual: '手动',
    triggerStartup: '启动'
  },

  feedback: {
    notTriggered: '自动化未触发',
    runCompleted: '自动化调用已完成',
    runFailed: '自动化调用失败',
    runError: '运行自动化失败',
    stopRequested: '已请求停止自动化重试',
    notRunning: '自动化未在运行',
    stopFailed: '停止自动化失败',
    enabled: '自动化已启用',
    disabled: '自动化已禁用',
    updateFailed: '更新自动化失败',
    deleted: '自动化已删除',
    deleteFailed: '删除自动化失败',
    updated: '自动化已更新',
    added: '自动化已添加',
    saveFailed: '保存自动化失败',
    selectCommand: '请选择命令'
  },

  page: {
    emptyDescription: '暂无自动化',
    noMatchDescription: '没有匹配的自动化',
    table: {
      enabled: '启用',
      name: '名称',
      command: '命令',
      trigger: '触发',
      lastRun: '上次运行',
      nextRun: '下次运行',
      status: '状态',
      actions: '操作'
    },
    deleteTitle: '删除自动化？',
    deleteDescription: ({ name }: { name: string }) => `确定要删除「${name}」吗？此操作无法撤销。`,
    deleting: '删除中'
  },

  row: {
    nextNone: '无',
    disabled: '已禁用',
    running: '运行中',
    notInvoked: '未调用',
    stopRetry: '停止重试',
    run: '运行',
    details: '详情'
  },

  toolbar: {
    filterAll: '全部',
    filterEnabled: '已启用',
    filterDisabled: '已禁用',
    filterRunning: '运行中',
    filterFailed: '失败',
    sortCreatedAt: '创建时间',
    sortName: '名称',
    sortLastRunAt: '最近运行',
    sortNextRunAt: '下次运行',
    sourceAll: '全部来源',
    sourceApp: '应用',
    sourceExtension: '扩展',
    searchPlaceholder: '搜索自动化…'
  },

  form: {
    addTitle: '添加自动化',
    editTitle: '编辑自动化',
    commandUnavailable: '命令当前不可用',
    name: '名称',
    namePlaceholder: '自动化名称',
    command: '命令',
    trigger: '触发',
    configure: '配置',
    failurePolicy: '失败策略',
    policyNone: '不重试',
    policyRetry: '重试',
    policyPause: '失败后暂停',
    retryCount: '重试次数',
    retryDelay: '重试延迟',
    seconds: '秒',
    params: '参数',
    configureTrigger: '配置触发',
    runOnStartup: '启动时运行',
    expression: '表达式',
    cronPlaceholder: 'Cron 表达式，留空则不启用',
    timezone: '时区',
    timezonePlaceholder: '系统时区',
    paramsMustBeObject: '参数必须是 JSON 对象',
    cronRequired: 'Cron 表达式不能为空',
    retryCountLabel: '重试次数',
    retryDelaySecondsLabel: '重试延迟秒数',
    mustBePositive: ({ label }: { label: string }) => `${label}必须大于 0`,
    mustBeNonNegativeInteger: ({ label }: { label: string }) => `${label}必须是大于等于 0 的整数`,
    invalidTimezone: '时区无效'
  },

  details: {
    commandDescription: '命令说明',
    app: '应用',
    running: '运行中',
    command: '命令',
    source: '来源',
    trigger: '触发',
    runTime: '运行时间',
    lastRun: ({ time }: { time: string }) => `最近 ${time}`,
    nextRun: ({ time }: { time: string }) => `下次 ${time}`,
    nextNone: '无',
    nextDisabled: '已禁用',
    createdAt: '创建',
    updatedAt: '更新',
    params: '参数',
    history: '调用历史',
    historyCount: ({ count }: { count: number }) => `${count} 条`,
    noHistory: '暂无调用历史',
    historySequence: '序号',
    historyStatus: '状态',
    historyTrigger: '触发',
    historyStartedAt: '开始时间',
    historyDuration: '耗时',
    historyResult: '结果',
    viewFullResult: '查看完整结果',
    runResult: '调用结果',
    runResultTitle: ({ title }: { title: string }) => `调用结果 ${title}`,
    attempt: '尝试',
    startedAt: '开始',
    finishedAt: '结束',
    duration: '耗时',
    error: '错误',
    result: '结果',
    noError: '无错误'
  },

  combobox: {
    searchPlaceholder: '搜索命令…',
    selectPlaceholder: '选择命令…',
    unavailable: '命令当前不可用'
  }
} satisfies Messages['automation']
