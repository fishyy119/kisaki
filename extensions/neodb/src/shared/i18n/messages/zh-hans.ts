import type { NeodbMessages } from '../index'

export const zhHans: NeodbMessages = {
  errors: {
    authRequired: '请先登录 NeoDB 账号',
    tokenRejected: 'NeoDB 登录已失效，请重新登录。',
    notFound: '该 NeoDB 条目不存在',
    rateLimited: '对 NeoDB 的请求过于频繁，请稍后重试。',
    rejected: 'NeoDB API 拒绝了请求',
    unavailable: 'NeoDB 实例暂时不可用',
    networkFailed: '对 NeoDB 的网络请求失败',
    operationCancelled: '操作已取消',
    instanceUrlInvalid: '请输入 http 或 https 地址',
    idInvalid: ({ value }) => `“${value}”不是有效的 NeoDB ID`,
    registrationFailed: '应用无法在该实例上完成自注册',
    loginStateMismatch: 'NeoDB 登录回调校验失败，请重新登录。',
    loginSessionExpired: 'NeoDB 登录会话已过期，请重新登录。',
    noPendingLogin: '没有等待完成的 NeoDB 登录',
    loginNotReady: 'NeoDB 登录尚未就绪',
    codeEmpty: '请输入授权码',
    operationRunning: '已有 NeoDB 书架操作正在运行，请等待其完成。'
  },

  oauth: {
    loginSucceededTitle: 'NeoDB 登录成功',
    loginFailedTitle: 'NeoDB 登录失败',
    loginCompleted: ({ userName }) => `已以 ${userName} 的身份登录`,
    callbackFailed: '无法完成 NeoDB 登录'
  },

  sync: {
    autoSyncFailedTitle: 'NeoDB 同步失败',
    autoSyncFailedFallback: '无法将变更推送到 NeoDB',
    pushTaskTitle: '将媒体库推送到 NeoDB 书架',
    pushSummary: ({ pushed, skipped, failed }) =>
      `已推送 ${pushed} 项、跳过 ${skipped} 项、失败 ${failed} 项`
  },

  import: {
    taskTitle: '导入 NeoDB 书架',
    phaseRead: '正在读取 NeoDB 书架',
    phaseApply: '正在应用书架条目',
    itemFailed: ({ id }) => `${id} 导入失败`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `新建 ${created} 项、更新 ${updated} 项、无变化 ${unchanged} 项、跳过 ${skipped} 项、失败 ${failed} 项`
  },

  commands: {
    verifyAccount: {
      title: '验证 NeoDB 账号',
      description: '向 NeoDB 实例校验已保存的登录'
    },
    pushAll: {
      title: '推送库到 NeoDB',
      description: '将所有带 NeoDB ID 的条目推送到书架'
    },
    importShelf: {
      title: '导入 NeoDB 书架',
      description: '将书架状态与评分写入匹配的本地条目'
    }
  },

  automations: {
    names: {
      'auth-check': 'NeoDB：启动时验证账号',
      'push-full-daily': 'NeoDB：每日全量推送',
      'import-refresh-weekly': 'NeoDB：每周书架刷新'
    },
    labels: {
      'auth-check': '启动时验证账号',
      'push-full-daily': '每日全量推送',
      'import-refresh-weekly': '每周书架刷新'
    },
    descriptions: {
      'auth-check': '应用启动时验证 NeoDB 登录',
      'push-full-daily': '每天凌晨将全部已关联条目推送到 NeoDB 书架',
      'import-refresh-weekly': '每周将书架状态与评分重新导入到已有条目'
    },
    status: {
      missing: '未创建',
      enabled: '已启用',
      disabled: '已禁用'
    }
  },

  settings: {
    webviewTitle: 'NeoDB',
    commandLabel: '设置',
    commandDescription: '登录 NeoDB 实例、导入书架并配置刮削'
  },

  ui: {
    loading: '加载中…',
    unavailable: '无法加载 NeoDB 设置',
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
      runningJobs: '运行中的 NeoDB 任务',
      running: '运行中',
      idle: '空闲',
      quickActionsTitle: '快捷入口',
      importAction: '导入 NeoDB 书架',
      maintenanceAction: '调整实例与客户端选项',
      automationsTitle: '自动化模板'
    },

    account: {
      title: '账号',
      description:
        '应用会在所选实例上自注册并经浏览器登录，登录永不过期。若浏览器无法跳回应用，请使用授权码方式。',
      statusLabel: '状态',
      configuredLabel: '已登录',
      missingLabel: '未登录',
      pendingLabel: '等待浏览器登录…',
      manualPendingLabel: '等待输入授权码…',
      instanceLabel: ({ instanceUrl }) => `实例：${instanceUrl}`,
      login: '使用浏览器登录',
      manualLogin: '使用授权码登录',
      codePlaceholder: '粘贴授权码',
      completeManual: '完成登录',
      cancelLogin: '取消登录',
      logout: '退出登录',
      verify: '验证账号',
      verifiedAs: ({ userName }) => `已以 ${userName} 的身份登录`
    },

    sync: {
      preferencesTitle: '自动推送偏好',
      syncEnabledLabel: '自动推送变更',
      syncEnabledDescription: '将带有 NeoDB ID 条目的状态与评分变更推送到书架',
      pushScoreLabel: '包含评分',
      pushScoreDescription: '将本地评分写入书架标记。本地评分为空时不会清除远端评分。',
      visibilityLabel: '标记可见性',
      visibilityDescription: '本应用写入标记时的联邦宇宙可见性',
      visibilityPublic: '公开',
      visibilityFollowers: '仅关注者',
      visibilitySelf: '仅自己',
      manualTitle: '手动推送',
      manualDescription: '将所有带 NeoDB ID 的条目推送到书架。进度与取消由任务中心接管。',
      pushAll: '立即全量推送'
    },

    import: {
      title: '导入书架',
      description: '将书架状态与评分写入匹配的条目。创建缺失条目时会经所选配置刮削完整元数据。',
      optionsLabel: '选项',
      updateExistingLabel: '更新已有条目',
      createMissingLabel: '创建缺失条目',
      profileLabel: '小说配置',
      profilePlaceholder: '选择配置',
      runLabel: '执行导入',
      runDescription: '以应用任务运行；以上选项仅作用于本次运行',
      startImport: '导入'
    },

    automation: {
      title: '推荐自动化',
      description: '此处仅创建推荐的 NeoDB 模板；启用状态、触发器与历史在应用的自动化页面管理',
      create: '创建'
    },

    maintenance: {
      instanceTitle: '实例',
      instanceDescription: '任意 NeoDB 部署均可使用，登录与其实例绑定',
      instanceUrlLabel: '实例地址',
      instanceUrlDescription: 'NeoDB 实例的根地址',
      restoreDefaults: '恢复旗舰实例',
      clientTitle: '客户端',
      clientDescription: '作用于所有 NeoDB 请求',
      timeoutLabel: '请求超时',
      timeoutDescription: '等待单次响应的秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '限流或服务器错误后的额外尝试次数',
      retryUnit: '次',
      actionsTitle: '维护操作',
      actionsDescription: '这些操作立即生效且不可撤销',
      reset: '恢复默认设置',
      resetDescription: '实例与偏好将恢复为默认值，登录状态保留。'
    }
  }
}
