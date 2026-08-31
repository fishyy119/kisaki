import type { AnilistMessages } from '../index'

export const zhHans: AnilistMessages = {
  errors: {
    authRequired: '请先登录你的 AniList 账号',
    tokenExpired: 'AniList 登录已过期，请重新登录',
    notFound: '该 AniList 条目不存在',
    rateLimited: 'AniList 请求过于频繁，请稍后再试',
    rejected: 'AniList 接口拒绝了该请求',
    unavailable: 'AniList 接口暂时不可用',
    networkFailed: 'AniList 接口网络请求失败',
    operationCancelled: '操作已取消',
    baseUrlInvalid: '请输入 http 或 https 地址',
    idInvalid: ({ value }) => `“${value}”不是有效的 AniList ID`,
    relayUnavailable: 'Kisaki OAuth 中继暂时不可用，请稍后再试',
    loginSessionExpired: 'AniList 登录会话已过期，请重新登录',
    loginCallbackInvalid: 'AniList 登录回调校验失败，请重新登录',
    noPendingLogin: '没有等待完成的 AniList 登录',
    loginNotReady: 'AniList 登录尚未就绪',
    operationRunning: '已有 AniList 列表操作在运行，请等待其完成'
  },

  oauth: {
    loginSucceededTitle: 'AniList 登录完成',
    loginFailedTitle: 'AniList 登录失败',
    loginCompleted: ({ userName }) => `已登录为 ${userName}`,
    callbackFailed: 'AniList 登录未能完成'
  },

  auth: {
    expiresSoonTitle: 'AniList 登录即将过期',
    expiresSoon: ({ days }) =>
      days > 0 ? `AniList 令牌将在 ${days} 天后过期，请重新登录以续期` : 'AniList 令牌已过期，请重新登录'
  },

  sync: {
    autoSyncFailedTitle: 'AniList 同步失败',
    autoSyncFailedFallback: '该更改未能推送到 AniList',
    pushTaskTitle: '推送库到 AniList 列表',
    pushSummary: ({ pushed, skipped, failed }) =>
      `已推送 ${pushed}，跳过 ${skipped}，失败 ${failed}`
  },

  import: {
    taskTitle: '导入 AniList 列表',
    phaseRead: '正在读取 AniList 列表',
    phaseApply: '正在应用列表条目',
    itemFailed: ({ id }) => `导入 ${id} 失败`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `新建 ${created}，更新 ${updated}，无变化 ${unchanged}，跳过 ${skipped}，失败 ${failed}`
  },

  commands: {
    verifyAccount: {
      title: '验证 AniList 账号',
      description: '向 AniList 接口校验已保存的登录，并在临近过期时提醒'
    },
    pushAll: {
      title: '推送库到 AniList',
      description: '将所有带 AniList ID 的条目推送到列表'
    },
    importLists: {
      title: '导入 AniList 列表',
      description: '将列表状态与评分写入匹配的本地条目'
    }
  },

  automations: {
    names: {
      'auth-check': 'AniList：启动时验证账号',
      'push-full-daily': 'AniList：每日全量推送',
      'import-refresh-weekly': 'AniList：每周列表刷新'
    },
    labels: {
      'auth-check': '启动时验证账号',
      'push-full-daily': '每日全量推送',
      'import-refresh-weekly': '每周列表刷新'
    },
    descriptions: {
      'auth-check': '应用启动时验证 AniList 登录，并在令牌临近过期时提醒',
      'push-full-daily': '每天凌晨将全部已关联条目推送到 AniList 列表',
      'import-refresh-weekly': '每周将列表状态与评分重新导入到已有条目'
    },
    status: {
      missing: '未创建',
      enabled: '已启用',
      disabled: '已禁用'
    }
  },

  settings: {
    webviewTitle: 'AniList',
    commandLabel: '设置',
    commandDescription: '登录 AniList、导入你的列表并配置刮削偏好'
  },

  ui: {
    loading: '加载中…',
    unavailable: '无法加载 AniList 设置',
    saved: '偏好已保存',
    savePreferences: '保存',
    discardChanges: '放弃更改',
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
      running: '运行中',
      completed: '已完成',
      failed: '已失败',
      cancelled: '已取消',
      cancel: '取消'
    },

    overview: {
      statusTitle: '状态总览',
      accountLabel: '账号',
      signedIn: '已登录',
      notSignedIn: '未登录',
      available: '可用',
      expiresSoon: '即将过期',
      expired: '已过期',
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
      runningJobs: '运行中的 AniList 任务',
      running: '运行中',
      idle: '空闲',
      quickActionsTitle: '快捷入口',
      importAction: '导入 AniList 列表',
      maintenanceAction: '调整接口与客户端选项',
      automationsTitle: '自动化模板'
    },

    account: {
      title: '账号',
      description: '通过浏览器登录以连接你的 AniList 列表。令牌约一年有效，且无法续期。',
      statusLabel: '状态',
      configuredLabel: '已登录',
      missingLabel: '未登录',
      pendingLabel: '等待浏览器登录…',
      expiresAtLabel: '令牌有效期至',
      expiredLabel: '已过期',
      login: '使用 AniList 登录',
      completeLogin: '我已完成授权',
      cancelLogin: '取消登录',
      logout: '退出登录',
      verify: '验证账号',
      verifiedAs: ({ userName }) => `已登录为 ${userName}`
    },

    sync: {
      preferencesTitle: '自动推送偏好',
      syncEnabledLabel: '自动推送更改',
      syncEnabledDescription: '带 AniList ID 的条目的状态与评分修改会推送到你的列表',
      pushScoreLabel: '包含评分',
      pushScoreDescription: '将本地评分写入 AniList；本地评分为空时不会清除远端评分',
      manualTitle: '手动推送',
      manualDescription: '将所有带 AniList ID 的条目推送到列表。进度与取消由任务中心接管。',
      pushAll: '立即全量推送'
    },

    import: {
      title: '导入列表',
      description: '将列表状态与评分写入匹配的条目。新建缺失条目时通过所选配置刮削。',
      optionsLabel: '选项',
      listAnime: '动画列表',
      listManga: '漫画列表',
      updateExistingLabel: '更新已有条目',
      createMissingLabel: '新建缺失条目',
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
      description: '此处仅创建推荐的 AniList 模板；启用状态、触发器与历史在应用的自动化页面管理',
      create: '创建'
    },

    maintenance: {
      endpointTitle: '接口地址',
      endpointDescription: '当官方地址不可达时，可指向镜像',
      graphqlUrlLabel: 'GraphQL 地址',
      graphqlUrlDescription: 'AniList GraphQL 接口的根地址',
      restoreDefaults: '恢复官方地址',
      clientTitle: '刮削与客户端',
      clientDescription: '应用于全部 AniList 搜索与刮削',
      preferRomajiLabel: '优先使用罗马字标题',
      preferRomajiDescription: '当内容语言没有对应标题时，使用罗马字标题作为显示名称',
      timeoutLabel: '请求超时',
      timeoutDescription: '等待单次 AniList 响应的秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '遇到限流或服务端错误后的额外尝试次数',
      retryUnit: '次',
      actionsTitle: '维护操作',
      actionsDescription: '这些操作立即生效且不可撤销',
      reset: '恢复默认设置',
      resetDescription: '地址与偏好恢复默认，登录保留'
    }
  }
}
