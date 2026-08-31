import type { VndbMessages } from '../index'

export const zhHans: VndbMessages = {
  errors: {
    tokenInvalid: 'VNDB 拒绝了该接口令牌，请在 VNDB 扩展设置中检查',
    tokenRequired: '请输入 VNDB 接口令牌',
    notFound: '该 VNDB 条目不存在',
    rateLimited: 'VNDB 请求过于频繁，请稍后再试',
    rejected: 'VNDB 接口拒绝了该请求',
    unavailable: 'VNDB 接口暂时不可用',
    networkFailed: 'VNDB 接口网络请求失败',
    operationCancelled: '操作已取消',
    baseUrlInvalid: '请输入 http 或 https 地址',
    idInvalid: ({ value }) => `“${value}”不是有效的 VNDB ID`,
    listPermissionMissing:
      '该 VNDB 令牌无法读取你的列表，请创建带 listread 与 listwrite 权限的令牌',
    operationRunning: '已有 VNDB 列表操作在运行，请等待其完成'
  },

  sync: {
    autoSyncFailedTitle: 'VNDB 同步失败',
    autoSyncFailedFallback: '该更改未能推送到 VNDB',
    pushTaskTitle: '推送库到 VNDB 列表',
    pushSummary: ({ pushed, skipped, failed }) =>
      `已推送 ${pushed}，跳过 ${skipped}，失败 ${failed}`
  },

  import: {
    taskTitle: '导入 VNDB 列表',
    phaseRead: '正在读取 VNDB 列表',
    phaseApply: '正在应用列表条目',
    itemFailed: ({ id }) => `导入 ${id} 失败`,
    summary: ({ created, updated, unchanged, skipped, failed }) =>
      `新建 ${created}，更新 ${updated}，无变化 ${unchanged}，跳过 ${skipped}，失败 ${failed}`
  },

  commands: {
    verifyAccount: {
      title: '验证 VNDB 账号',
      description: '向 VNDB 接口校验已保存的令牌及其列表权限'
    },
    pushAll: {
      title: '推送库到 VNDB',
      description: '将所有带 VNDB ID 的条目推送到列表'
    },
    importList: {
      title: '导入 VNDB 列表',
      description: '将列表状态与投票写入匹配的本地条目'
    }
  },

  automations: {
    names: {
      'auth-check': 'VNDB：启动时验证账号',
      'push-full-daily': 'VNDB：每日全量推送',
      'import-refresh-weekly': 'VNDB：每周列表刷新'
    },
    labels: {
      'auth-check': '启动时验证账号',
      'push-full-daily': '每日全量推送',
      'import-refresh-weekly': '每周列表刷新'
    },
    descriptions: {
      'auth-check': '应用启动时验证 VNDB 令牌及其列表权限',
      'push-full-daily': '每天凌晨将全部已关联条目推送到 VNDB 列表',
      'import-refresh-weekly': '每周将列表状态与投票重新导入到已有条目'
    },
    status: {
      missing: '未创建',
      enabled: '已启用',
      disabled: '已禁用'
    }
  },

  settings: {
    webviewTitle: 'VNDB',
    commandLabel: '设置',
    commandDescription: '配置可选的 VNDB 接口令牌、地址与刮削偏好'
  },

  ui: {
    loading: '加载中…',
    unavailable: '无法加载 VNDB 设置',
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
      tokenConfigured: '已配置令牌',
      anonymous: '匿名访问',
      available: '可用',
      autoSyncLabel: '自动推送',
      enabled: '已启用',
      disabled: '已禁用',
      withScore: '状态与投票',
      withoutScore: '仅状态',
      recommendedAutomations: '推荐自动化',
      automationsComplete: '已全部创建',
      automationsMissing: ({ count }) => `${count} 项未创建`,
      templatesCount: ({ count }) => `${count} 个模板`,
      runtimeTitle: '运行状态',
      runningJobs: '运行中的 VNDB 任务',
      running: '运行中',
      idle: '空闲',
      quickActionsTitle: '快捷入口',
      importAction: '导入 VNDB 列表',
      maintenanceAction: '调整接口与客户端选项',
      automationsTitle: '自动化模板'
    },

    account: {
      title: '接口令牌',
      description:
        'Kana 接口开放访问，无需令牌即可刮削。填写个人令牌可提高速率上限；列表联动需要 listread 与 listwrite 权限。',
      statusLabel: '状态',
      inputLabel: '令牌',
      inputPlaceholder: '粘贴你的 VNDB 令牌',
      configuredLabel: '已配置',
      missingLabel: '匿名访问',
      save: '保存令牌',
      clear: '移除令牌',
      test: '测试连接',
      saveSucceeded: '接口令牌已保存',
      clearSucceeded: '接口令牌已移除',
      testSucceeded: 'VNDB 已接受该请求',
      openSettings: '前往 vndb.org 创建令牌',
      verify: '验证账号',
      verifiedAs: ({ username }) => `已登录为 ${username}`,
      permissionsLabel: '列表权限',
      listRead: '读取',
      listWrite: '写入',
      permissionGranted: '已授权',
      permissionMissing: '缺失'
    },

    sync: {
      preferencesTitle: '自动推送偏好',
      preferencesDescription: '推送到列表需要带 listread 与 listwrite 权限的令牌',
      syncEnabledLabel: '自动推送更改',
      syncEnabledDescription: '带 VNDB ID 的条目的状态与评分修改会推送到你的列表',
      pushScoreLabel: '包含评分',
      pushScoreDescription: '将本地评分写入为 VNDB 投票；本地评分为空时不会清除远端投票',
      manualTitle: '手动推送',
      manualDescription: '将所有带 VNDB ID 的条目推送到列表。进度与取消由任务中心接管。',
      pushAll: '立即全量推送'
    },

    import: {
      title: '导入列表',
      description: '将列表状态与投票写入匹配的条目。新建缺失条目时通过所选配置刮削。',
      optionsLabel: '选项',
      updateExistingLabel: '更新已有条目',
      createMissingLabel: '新建缺失条目',
      profileLabel: '游戏配置',
      profilePlaceholder: '选择配置',
      runLabel: '执行导入',
      runDescription: '以应用任务运行；以上选项仅作用于本次运行',
      startImport: '导入'
    },

    automation: {
      title: '推荐自动化',
      description: '此处仅创建推荐的 VNDB 模板；启用状态、触发器与历史在应用的自动化页面管理',
      create: '创建'
    },

    maintenance: {
      endpointTitle: '接口地址',
      endpointDescription: '当官方地址不可达时，可指向镜像',
      apiBaseUrlLabel: '接口基础地址',
      apiBaseUrlDescription: 'VNDB Kana 接口的根地址',
      restoreDefaults: '恢复官方地址',
      clientTitle: '刮削与客户端',
      clientDescription: '应用于全部 VNDB 搜索与刮削',
      preferRomanizedLabel: '优先使用罗马字标题',
      preferRomanizedDescription: '当内容语言没有对应标题时，使用罗马字标题作为显示名称',
      timeoutLabel: '请求超时',
      timeoutDescription: '等待单次 VNDB 响应的秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '遇到限流或服务端错误后的额外尝试次数',
      retryUnit: '次',
      actionsTitle: '维护操作',
      actionsDescription: '这些操作立即生效且不可撤销',
      reset: '恢复默认设置',
      resetDescription: '地址与偏好恢复默认，令牌保留',
      resetSucceeded: '已恢复默认设置'
    }
  }
}
