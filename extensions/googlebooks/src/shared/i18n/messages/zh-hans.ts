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

    integration: {
      title: '书库导入',
      description:
        '读取已购书库与阅读书架，将状态写入匹配条目，并经所选配置创建缺失条目。Google Books 承载的是购买而非追踪，因此不做反向推送。',
      includeEbooksLabel: '我的 Google 电子书',
      includeEbooksDescription: '已购与已上传的书库，导入时不写入状态',
      includeShelvesLabel: '阅读书架',
      includeShelvesDescription: '想读、在读、读完将写入为条目状态',
      updateExistingLabel: '更新已有条目',
      createMissingLabel: '创建缺失条目',
      mergeSeriesLabel: '合并系列分卷',
      mergeSeriesDescription: '同一系列的多卷只以第一卷创建条目',
      novelProfileLabel: '小说配置',
      comicProfileLabel: '漫画配置',
      profilePlaceholder: '选择配置',
      startImport: '导入',
      taskProgress: ({ current, total }) => `${current} / ${total}`,
      taskRunning: '进行中',
      taskCompleted: '已完成',
      taskFailed: '失败',
      taskCancelled: '已取消',
      cancelTask: '取消'
    },

    endpoints: {
      title: '端点',
      description: 'Google 登录经 Kisaki 中继完成',
      relayUrlLabel: 'OAuth 中继地址',
      relayUrlDescription: 'Kisaki 中继上 Google Books 路由的根地址',
      restoreDefaults: '恢复默认中继'
    },

    preferences: {
      title: '偏好',
      description: '作用于所有 Google Books 请求',
      timeoutLabel: '请求超时',
      timeoutDescription: '等待单次响应的秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '限流或服务器错误后的额外尝试次数',
      retryUnit: '次',
      reset: '恢复默认设置',
      resetDescription: '端点与偏好将恢复为默认值，登录状态保留。',
      resetSucceeded: '已恢复默认设置'
    }
  }
}
