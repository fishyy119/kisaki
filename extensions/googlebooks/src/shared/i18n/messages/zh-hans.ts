import type { GbooksMessages } from '../index'

export const zhHans: GbooksMessages = {
  errors: {
    authRequired: '请先登录 Google 账号',
    tokenExpired: 'Google 登录已过期，请重新登录。',
    notFound: '该 Google Books 卷不存在',
    rateLimited: 'Google Books 搜索配额已用尽。可添加个人 API 密钥或稍后重试。',
    rejected: 'Google Books API 拒绝了请求',
    unavailable: 'Google Books API 暂时不可用',
    networkFailed: '对 Google Books 的网络请求失败',
    relayUnavailable: 'Kisaki OAuth 中继暂时不可用，请稍后重试。',
    loginSessionExpired: 'Google 登录会话已过期，请重新登录。',
    loginCallbackInvalid: 'Google 登录回调校验失败，请重新登录。',
    noPendingLogin: '没有等待完成的 Google 登录',
    loginNotReady: 'Google 登录尚未就绪',
    operationCancelled: '操作已取消',
    baseUrlInvalid: '请输入 http 或 https 地址',
    idInvalid: ({ value }) => `“${value}”不是有效的 Google Books 卷 ID`,
    keyEmpty: '请输入 API 密钥',
    operationRunning: '已有 Google Books 导入正在运行，请等待其完成。'
  },

  oauth: {
    loginSucceededTitle: 'Google 登录成功',
    loginFailedTitle: 'Google 登录失败',
    loginCompleted: '已连接 Google Books 书库',
    callbackFailed: '无法完成 Google 登录'
  },

  import: {
    taskTitle: '导入 Google Books 书库',
    phaseRead: '正在读取 Google Books 书架',
    phaseApply: '正在应用条目',
    itemFailed: ({ id }) => `${id} 导入失败`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `新建 ${created} 项、更新 ${updated} 项、无变化 ${unchanged} 项、跳过 ${skipped} 项、失败 ${failed} 项`
  },

  commands: {
    importLibrary: {
      title: '导入 Google Books 书库',
      description: '将书库与书架状态写入匹配的本地条目'
    }
  },

  automations: {
    names: {
      'import-refresh-weekly': 'Google Books：每周书库刷新'
    },
    labels: {
      'import-refresh-weekly': '每周书库刷新'
    },
    descriptions: {
      'import-refresh-weekly': '每周将书库与书架状态重新导入到已有条目'
    },
    status: {
      missing: '未创建',
      enabled: '已启用',
      disabled: '已禁用'
    }
  },

  settings: {
    webviewTitle: 'Google Books',
    commandLabel: '设置',
    commandDescription: '登录 Google Books、导入书库并配置刮削'
  },

  ui: {
    loading: '加载中…',
    unavailable: '无法加载 Google Books 设置',
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
      recommendedAutomations: '推荐自动化',
      automationsComplete: '已全部创建',
      automationsMissing: ({ count }) => `${count} 项未创建`,
      templatesCount: ({ count }) => `${count} 个模板`,
      runtimeTitle: '运行状态',
      runningJobs: '运行中的 Google Books 任务',
      running: '运行中',
      idle: '空闲',
      quickActionsTitle: '快捷入口',
      importAction: '导入 Google Books 书库',
      maintenanceAction: '调整客户端选项',
      automationsTitle: '自动化模板'
    },

    account: {
      title: '账号',
      description:
        '通过浏览器登录以连接 Google Books 书库。搜索无需登录；个人 API 密钥可选，用于提升搜索配额。',
      statusLabel: '状态',
      configuredLabel: '已登录',
      missingLabel: '未登录',
      pendingLabel: '等待浏览器登录…',
      login: '使用 Google 登录',
      completeLogin: '我已完成授权',
      cancelLogin: '取消登录',
      logout: '退出登录',
      apiKeyLabel: 'API 密钥(可选)',
      apiKeyDescription: '用于提升搜索配额，可在 Google Cloud 控制台创建',
      apiKeyPlaceholder: '粘贴 API 密钥',
      apiKeyConfigured: '已保存 API 密钥',
      saveKey: '保存密钥',
      clearKey: '移除密钥'
    },

    import: {
      title: '书库导入',
      description:
        '读取已购书库与阅读书架，将状态写入匹配条目，并经所选配置创建缺失条目。Google Books 承载的是购买而非追踪，因此不做反向推送。',
      includeEbooksLabel: '我的 Google 电子书',
      includeEbooksDescription: '已购与已上传的书库，导入时不写入状态',
      includeShelvesLabel: '阅读书架',
      includeShelvesDescription: '想读、在读、读完将写入为条目状态',
      mergeSeriesLabel: '合并系列分卷',
      mergeSeriesDescription: '同一系列的多卷只以第一卷创建条目',
      optionsLabel: '选项',
      updateExistingLabel: '更新已有条目',
      createMissingLabel: '创建缺失条目',
      novelProfileLabel: '小说配置',
      comicProfileLabel: '漫画配置',
      profilePlaceholder: '选择配置',
      runLabel: '执行导入',
      runDescription: '以应用任务运行；以上选项仅作用于本次运行',
      startImport: '导入'
    },

    automation: {
      title: '推荐自动化',
      description:
        '此处仅创建推荐的 Google Books 模板；启用状态、触发器与历史在应用的自动化页面管理',
      create: '创建'
    },

    maintenance: {
      clientTitle: '客户端',
      clientDescription: '作用于所有 Google Books 请求',
      timeoutLabel: '请求超时',
      timeoutDescription: '等待单次响应的秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '限流或服务器错误后的额外尝试次数',
      retryUnit: '次',
      actionsTitle: '维护操作',
      actionsDescription: '这些操作立即生效且不可撤销',
      reset: '恢复默认设置',
      resetDescription: '偏好将恢复为默认值，登录状态保留。'
    }
  }
}
