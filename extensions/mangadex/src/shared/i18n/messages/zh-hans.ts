import type { MangadexMessages } from '../index'

export const zhHans: MangadexMessages = {
  errors: {
    authRequired: '请先保存 MangaDex 个人客户端凭据',
    authFailed: 'MangaDex 拒绝了凭据，请检查四项内容是否正确。',
    notFound: '该 MangaDex 条目不存在',
    rateLimited: '对 MangaDex 的请求过于频繁，请稍后重试。',
    rejected: 'MangaDex API 拒绝了请求',
    unavailable: 'MangaDex API 暂时不可用',
    networkFailed: '对 MangaDex 的网络请求失败',
    operationCancelled: '操作已取消',
    idInvalid: ({ value }) => `“${value}”不是有效的 MangaDex ID`,
    credentialsIncomplete: '请填写全部四项凭据',
    operationRunning: '已有 MangaDex 列表操作正在运行，请等待其完成。'
  },

  sync: {
    autoSyncFailedTitle: 'MangaDex 同步失败',
    autoSyncFailedFallback: '无法将变更推送到 MangaDex',
    pushTaskTitle: '将媒体库推送到 MangaDex',
    pushSummary: ({ pushed, skipped, failed }) =>
      `已推送 ${pushed} 项、跳过 ${skipped} 项、失败 ${failed} 项`
  },

  import: {
    taskTitle: '导入 MangaDex 阅读状态',
    phaseRead: '正在读取 MangaDex 状态',
    phaseApply: '正在应用条目',
    itemFailed: ({ id }) => `${id} 导入失败`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `新建 ${created} 项、更新 ${updated} 项、无变化 ${unchanged} 项、跳过 ${skipped} 项、失败 ${failed} 项`
  },

  commands: {
    verifyAccount: {
      title: '验证 MangaDex 账号',
      description: '向 MangaDex 接口校验已保存的凭据'
    },
    pushAll: {
      title: '推送库到 MangaDex',
      description: '将所有带 MangaDex ID 的条目推送到账号'
    },
    importStatuses: {
      title: '导入 MangaDex 阅读状态',
      description: '将阅读状态与评分写入匹配的本地条目'
    }
  },

  automations: {
    names: {
      'auth-check': 'MangaDex：启动时验证账号',
      'push-full-daily': 'MangaDex：每日全量推送',
      'import-refresh-weekly': 'MangaDex：每周状态刷新'
    },
    labels: {
      'auth-check': '启动时验证账号',
      'push-full-daily': '每日全量推送',
      'import-refresh-weekly': '每周状态刷新'
    },
    descriptions: {
      'auth-check': '应用启动时验证 MangaDex 凭据',
      'push-full-daily': '每天凌晨将全部已关联条目推送到 MangaDex 账号',
      'import-refresh-weekly': '每周将阅读状态与评分重新导入到已有条目'
    },
    status: {
      missing: '未创建',
      enabled: '已启用',
      disabled: '已禁用'
    }
  },

  settings: {
    webviewTitle: 'MangaDex',
    commandLabel: '设置',
    commandDescription: '连接 MangaDex 账号、导入阅读状态并配置刮削'
  },

  ui: {
    loading: '加载中…',
    unavailable: '无法加载 MangaDex 设置',
    saved: '设置已保存',
    savePreferences: '保存',
    discardChanges: '放弃',
    unsavedChanges: '有未保存的更改',
    actionFailed: '操作失败',
    cancel: '取消',
    confirm: '确认',

    tabs: {
      overview: '概览',
      account: '账号',
      sync: '同步',
      import: '导入',
      automation: '自动化',
      maintenance: '维护'
    },

    task: {
      progress: ({ current, total }) => `${current} / ${total}`,
      running: '进行中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
      cancel: '取消'
    },

    overview: {
      statusTitle: '状态总览',
      accountLabel: '账号',
      connected: '已连接',
      notConnected: '未连接',
      available: '可用',
      autoSyncLabel: '自动推送',
      enabled: '已启用',
      disabled: '已禁用',
      withScore: '状态与评分',
      withoutScore: '仅状态',
      recommendedAutomations: '推荐自动化',
      automationsComplete: '已全部创建',
      automationsMissing: ({ count }) => `${count} 项未创建`,
      templatesCount: ({ count }) => `${count} 个模板`,
      runtimeTitle: '运行状态',
      runningJobs: '运行中的 MangaDex 任务',
      running: '运行中',
      idle: '空闲',
      quickActionsTitle: '快捷入口',
      importAction: '导入 MangaDex 阅读状态',
      maintenanceAction: '调整接口与客户端选项',
      automationsTitle: '自动化模板'
    },

    account: {
      title: '账号',
      description:
        'MangaDex 个人工具通过个人 API 客户端登录。请在 MangaDex 设置中创建一个，然后填写其 ID 与密钥，以及账号用户名和密码；全部内容仅保存在本地密钥库。',
      statusLabel: '状态',
      configuredLabel: '已连接',
      missingLabel: '未连接',
      clientIdLabel: '客户端 ID',
      clientSecretLabel: '客户端密钥',
      usernameLabel: '用户名',
      passwordLabel: '密码',
      save: '连接账号',
      clear: '断开连接',
      verify: '验证账号',
      verifiedAs: ({ userName }) => `已以 ${userName} 的身份连接`,
      openClientSettings: '打开 MangaDex API 客户端页面'
    },

    sync: {
      preferencesTitle: '自动推送偏好',
      syncEnabledLabel: '自动推送变更',
      syncEnabledDescription: '将带有 MangaDex ID 条目的状态与评分变更推送到账号',
      pushScoreLabel: '包含评分',
      pushScoreDescription: '将本地评分写入 MangaDex 评分。本地评分为空时不会清除远端评分。',
      manualTitle: '手动推送',
      manualDescription: '将所有带 MangaDex ID 的条目推送到账号。进度与取消由任务中心接管。',
      pushAll: '立即全量推送'
    },

    import: {
      title: '导入阅读状态',
      description: '将阅读状态写入匹配的条目。创建缺失条目时会经所选配置刮削完整元数据。',
      optionsLabel: '选项',
      importScoresLabel: '同时导入评分',
      updateExistingLabel: '更新已有条目',
      createMissingLabel: '创建缺失条目',
      profileLabel: '漫画配置',
      profilePlaceholder: '选择配置',
      runLabel: '执行导入',
      runDescription: '以应用任务运行；以上选项仅作用于本次运行',
      startImport: '导入'
    },

    automation: {
      title: '推荐自动化',
      description: '此处仅创建推荐的 MangaDex 模板；启用状态、触发器与历史在应用的自动化页面管理',
      create: '创建'
    },

    maintenance: {
      endpointTitle: '接口地址',
      endpointDescription: '当官方地址不可达时，可指向镜像',
      apiUrlLabel: 'API 地址',
      apiUrlDescription: 'MangaDex REST API 的根地址；登录流量仍走官方地址',
      restoreDefaults: '恢复官方地址',
      clientTitle: '刮削与客户端',
      clientDescription: '作用于所有 MangaDex 搜索与刮削',
      preferRomanizedLabel: '优先罗马字标题',
      preferRomanizedDescription: '当没有匹配内容语言的标题时，使用罗马字标题作为显示名称',
      timeoutLabel: '请求超时',
      timeoutDescription: '等待单次响应的秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '限流或服务器错误后的额外尝试次数',
      retryUnit: '次',
      actionsTitle: '维护操作',
      actionsDescription: '这些操作立即生效且不可撤销',
      reset: '恢复默认设置',
      resetDescription: '偏好将恢复为默认值，已保存的凭据保留。'
    }
  }
}
