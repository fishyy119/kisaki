import type { SteamMessages } from '../index'

export const zhHans: SteamMessages = {
  errors: {
    keyRequired: '请先保存 Steam Web API 密钥',
    steamIdInvalid: '请输入有效的 SteamID64(以 7656 开头的 17 位数字)',
    keyRejected: 'Steam 拒绝了该 Web API 密钥',
    profileRequired: '请先创建游戏刮削配置',
    profileNotVisible: 'Steam 未返回任何游戏。请检查 SteamID，并确认资料中的游戏详情已公开。',
    notFound: '该 Steam 应用不存在或未在商店公开',
    rateLimited: '对 Steam 的请求过于频繁，请稍后重试。',
    rejected: 'Steam API 拒绝了请求',
    unavailable: 'Steam API 暂时不可用',
    networkFailed: '对 Steam 的网络请求失败',
    operationCancelled: '操作已取消',
    idInvalid: ({ value }) => `“${value}”不是有效的 Steam 应用 ID`,
    keyEmpty: '请输入 Web API 密钥',
    operationRunning: '已有 Steam 导入正在运行，请等待其完成。'
  },

  import: {
    taskTitle: '导入已拥有的 Steam 游戏',
    phaseRead: '正在读取拥有的游戏',
    phaseApply: '正在创建条目',
    itemFailed: ({ id }) => `${id} 导入失败`,
    summary: ({ created, existing, failed }) =>
      `新建 ${created} 项、已存在 ${existing} 项、失败 ${failed} 项`
  },

  commands: {
    verifyAccount: {
      title: '验证 Steam 账号',
      description: '通过统计拥有的游戏校验已保存的 Web API 密钥与 SteamID'
    },
    importOwned: {
      title: '导入已拥有的 Steam 游戏',
      description: '为库中尚不存在的已拥有游戏创建条目'
    }
  },

  automations: {
    names: {
      'auth-check': 'Steam：启动时验证账号',
      'import-refresh-weekly': 'Steam：每周导入已拥有游戏'
    },
    labels: {
      'auth-check': '启动时验证账号',
      'import-refresh-weekly': '每周导入已拥有游戏'
    },
    descriptions: {
      'auth-check': '应用启动时验证 Steam Web API 密钥与 SteamID',
      'import-refresh-weekly': '每周通过模板固化的配置导入新拥有的游戏'
    },
    status: {
      missing: '未创建',
      enabled: '已启用',
      disabled: '已禁用'
    }
  },

  settings: {
    webviewTitle: 'Steam',
    commandLabel: '设置',
    commandDescription: '连接 Steam 账号、导入已拥有游戏并配置刮削'
  },

  ui: {
    loading: '加载中…',
    unavailable: '无法加载 Steam 设置',
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
      keyConfigured: '已保存密钥',
      noKey: '未保存密钥',
      available: '可用',
      recommendedAutomations: '推荐自动化',
      automationsComplete: '已全部创建',
      automationsMissing: ({ count }) => `${count} 项未创建`,
      templatesCount: ({ count }) => `${count} 个模板`,
      runtimeTitle: '运行状态',
      runningJobs: '运行中的 Steam 任务',
      running: '运行中',
      idle: '空闲',
      quickActionsTitle: '快捷入口',
      importAction: '导入已拥有的 Steam 游戏',
      maintenanceAction: '调整客户端选项',
      automationsTitle: '自动化模板'
    },

    account: {
      title: '账号',
      description:
        '导入已拥有游戏需要个人 Web API 密钥与账号的 SteamID64，且资料中的游戏详情需设为公开。',
      statusLabel: '状态',
      configuredLabel: '已保存密钥',
      missingLabel: '未保存密钥',
      keyLabel: 'Web API 密钥',
      keyPlaceholder: '粘贴 Web API 密钥',
      steamIdLabel: 'SteamID64',
      steamIdDescription: '17 位数字，可在资料页 URL 或第三方工具中查看',
      saveKey: '保存密钥',
      clearKey: '移除密钥',
      verify: '验证',
      verifiedGames: ({ count }) => `可见 ${count} 款游戏`,
      openKeyPage: '获取 Web API 密钥'
    },

    import: {
      title: '已拥有游戏导入',
      description: '读取拥有的游戏库，并经所选配置创建缺失条目。已带有 Steam ID 的条目保持不变。',
      profileLabel: '游戏配置',
      profilePlaceholder: '选择配置',
      runLabel: '执行导入',
      runDescription: '以应用任务运行；以上选项仅作用于本次运行',
      startImport: '导入已拥有游戏'
    },

    automation: {
      title: '推荐自动化',
      description: '此处仅创建推荐的 Steam 模板；启用状态、触发器与历史在应用的自动化页面管理',
      create: '创建'
    },

    maintenance: {
      clientTitle: '客户端',
      clientDescription: '作用于所有 Steam 请求',
      timeoutLabel: '请求超时',
      timeoutDescription: '等待单次响应的秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '限流或服务器错误后的额外尝试次数',
      retryUnit: '次',
      actionsTitle: '维护操作',
      actionsDescription: '这些操作立即生效且不可撤销',
      reset: '恢复默认设置',
      resetDescription: '偏好将恢复为默认值，已保存的密钥保留。'
    }
  }
}
