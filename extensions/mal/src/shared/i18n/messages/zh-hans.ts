import type { MalMessages } from '../index'

export const zhHans: MalMessages = {
  errors: {
    authRequired: '请先登录 MyAnimeList 账号',
    tokenExpired: 'MyAnimeList 登录已过期，请重新登录。',
    notFound: '该 MyAnimeList 条目不存在',
    rateLimited: '对 MyAnimeList 的请求过于频繁，请稍后重试。',
    rejected: 'MyAnimeList API 拒绝了请求',
    unavailable: 'MyAnimeList API 暂时不可用',
    networkFailed: '对 MyAnimeList 的网络请求失败',
    mirrorUnavailable: '元数据镜像暂时不可用',
    operationCancelled: '操作已取消',
    baseUrlInvalid: '请输入 http 或 https 地址',
    idInvalid: ({ value }) => `“${value}”不是有效的 MyAnimeList ID`,
    loginStateMismatch: 'MyAnimeList 登录回调校验失败，请重新登录。',
    loginDenied: 'MyAnimeList 授权已被拒绝，请重新登录。',
    loginAuthorizeFailed: 'MyAnimeList 返回了授权错误，请重新登录。',
    loginSessionExpired: 'MyAnimeList 登录会话已过期，请重新登录。',
    noPendingLogin: '没有等待完成的 MyAnimeList 登录',
    loginNotReady: 'MyAnimeList 登录尚未就绪',
    operationRunning: '已有 MyAnimeList 列表操作正在运行，请等待其完成。'
  },

  oauth: {
    loginSucceededTitle: 'MyAnimeList 登录成功',
    loginFailedTitle: 'MyAnimeList 登录失败',
    loginCompleted: ({ userName }) => `已以 ${userName} 的身份登录`,
    callbackFailed: '无法完成 MyAnimeList 登录'
  },

  sync: {
    autoSyncFailedTitle: 'MyAnimeList 同步失败',
    autoSyncFailedFallback: '无法将变更推送到 MyAnimeList',
    pushTaskTitle: '将媒体库推送到 MyAnimeList 列表',
    pushSummary: ({ pushed, skipped, failed }) =>
      `已推送 ${pushed} 项、跳过 ${skipped} 项、失败 ${failed} 项`
  },

  import: {
    taskTitle: '导入 MyAnimeList 列表',
    phaseRead: '正在读取 MyAnimeList 列表',
    phaseApply: '正在应用列表条目',
    itemFailed: ({ id }) => `${id} 导入失败`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `新建 ${created} 项、更新 ${updated} 项、无变化 ${unchanged} 项、跳过 ${skipped} 项、失败 ${failed} 项`
  },

  commands: {
    verifyAccount: {
      title: '验证 MyAnimeList 账号',
      description: '向 MyAnimeList 接口校验已保存的登录'
    },
    pushAll: {
      title: '推送库到 MyAnimeList',
      description: '将所有带 MyAnimeList ID 的条目推送到列表'
    },
    importLists: {
      title: '导入 MyAnimeList 列表',
      description: '将列表状态与评分写入匹配的本地条目'
    }
  },

  automations: {
    names: {
      'auth-check': 'MyAnimeList：启动时验证账号',
      'push-full-daily': 'MyAnimeList：每日全量推送',
      'import-refresh-weekly': 'MyAnimeList：每周列表刷新'
    },
    labels: {
      'auth-check': '启动时验证账号',
      'push-full-daily': '每日全量推送',
      'import-refresh-weekly': '每周列表刷新'
    },
    descriptions: {
      'auth-check': '应用启动时验证 MyAnimeList 登录，并保持令牌自动刷新',
      'push-full-daily': '每天凌晨将全部已关联条目推送到 MyAnimeList 列表',
      'import-refresh-weekly': '每周将列表状态与评分重新导入到已有条目'
    },
    status: {
      missing: '未创建',
      enabled: '已启用',
      disabled: '已禁用'
    }
  },

  settings: {
    webviewTitle: 'MyAnimeList',
    commandLabel: '设置',
    commandDescription: '登录 MyAnimeList、导入列表并配置刮削'
  },

  ui: {
    loading: '加载中…',
    unavailable: '无法加载 MyAnimeList 设置',
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
      signedIn: '已登录',
      notSignedIn: '未登录',
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
      runningJobs: '运行中的 MyAnimeList 任务',
      running: '运行中',
      idle: '空闲',
      quickActionsTitle: '快捷入口',
      importAction: '导入 MyAnimeList 列表',
      maintenanceAction: '调整端点与客户端选项',
      automationsTitle: '自动化模板'
    },

    account: {
      title: '账号',
      description: '通过浏览器登录以连接 MyAnimeList 列表。登录直连 MyAnimeList，令牌会自动刷新。',
      statusLabel: '状态',
      configuredLabel: '已登录',
      missingLabel: '未登录',
      pendingLabel: '等待浏览器登录…',
      expiresAtLabel: '令牌有效期至',
      expiredLabel: '已过期',
      login: '使用 MyAnimeList 登录',
      cancelLogin: '取消登录',
      logout: '退出登录',
      verify: '验证账号',
      verifiedAs: ({ userName }) => `已以 ${userName} 的身份登录`
    },

    sync: {
      preferencesTitle: '自动推送偏好',
      syncEnabledLabel: '自动推送变更',
      syncEnabledDescription: '将带有 MyAnimeList ID 条目的状态与评分变更推送到列表',
      pushScoreLabel: '包含评分',
      pushScoreDescription: '将本地评分写入 MyAnimeList。本地评分为空时不会清除远端评分。',
      manualTitle: '手动推送',
      manualDescription: '将所有带 MyAnimeList ID 的条目推送到列表。进度与取消由任务中心接管。',
      pushAll: '立即全量推送'
    },

    import: {
      title: '导入列表',
      description: '将列表状态与评分写入匹配的条目。创建缺失条目时会经所选配置刮削完整元数据。',
      optionsLabel: '选项',
      listAnime: '动画列表',
      listManga: '漫画列表',
      updateExistingLabel: '更新已有条目',
      createMissingLabel: '创建缺失条目',
      animeProfileLabel: '动画配置',
      comicProfileLabel: '漫画配置',
      novelProfileLabel: '小说配置',
      profilePlaceholder: '选择配置',
      runLabel: '执行导入',
      runDescription: '以应用任务运行；以上选项仅作用于本次运行',
      startImport: '导入'
    },

    automation: {
      title: '推荐自动化',
      description:
        '此处仅创建推荐的 MyAnimeList 模板；启用状态、触发器与历史在应用的自动化页面管理',
      create: '创建'
    },

    maintenance: {
      endpointTitle: '端点',
      endpointDescription: '官方 API 根地址与 Jikan 兼容元数据镜像',
      apiUrlLabel: 'API 地址',
      apiUrlDescription: 'MyAnimeList 官方 API v2 的根地址',
      mirrorEnabledLabel: '使用元数据镜像',
      mirrorEnabledDescription: '角色、工作人员与剧集数据来自镜像；关闭后这些槽位保持缺席',
      mirrorUrlLabel: '镜像地址',
      mirrorUrlDescription: 'Jikan v4 兼容 API 的根地址，如 Tenrai 或自托管 Jikan',
      restoreDefaults: '恢复官方端点',
      clientTitle: '刮削与客户端',
      clientDescription: '作用于所有 MyAnimeList 搜索与刮削',
      preferRomajiLabel: '优先罗马字标题',
      preferRomajiDescription: '当没有匹配内容语言的标题时，使用罗马字标题作为显示名称',
      timeoutLabel: '请求超时',
      timeoutDescription: '等待单次响应的秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '限流或服务器错误后的额外尝试次数',
      retryUnit: '次',
      actionsTitle: '维护操作',
      actionsDescription: '这些操作立即生效且不可撤销',
      reset: '恢复默认设置',
      resetDescription: '端点与偏好将恢复为默认值，登录状态保留。'
    }
  }
}
