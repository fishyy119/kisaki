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

    integration: {
      title: '阅读联动',
      syncEnabledLabel: '自动推送变更',
      syncEnabledDescription: '将带有 MangaDex ID 条目的状态与评分变更推送到账号',
      pushScoreLabel: '包含评分',
      pushScoreDescription: '将本地评分写入 MangaDex 评分。本地评分为空时不会清除远端评分。',
      pushAll: '立即全量推送',
      importTitle: '导入阅读状态',
      importDescription: '将阅读状态写入匹配的条目。创建缺失条目时会经所选配置刮削完整元数据。',
      importScoresLabel: '同时导入评分',
      updateExistingLabel: '更新已有条目',
      createMissingLabel: '创建缺失条目',
      profilePlaceholder: '选择配置',
      startImport: '导入',
      taskProgress: ({ current, total }) => `${current} / ${total}`,
      taskRunning: '进行中',
      taskCompleted: '已完成',
      taskFailed: '失败',
      taskCancelled: '已取消',
      cancelTask: '取消'
    },

    preferences: {
      title: '偏好',
      description: '作用于所有 MangaDex 搜索与刮削',
      preferRomanizedLabel: '优先罗马字标题',
      preferRomanizedDescription: '当没有匹配内容语言的标题时，使用罗马字标题作为显示名称',
      timeoutLabel: '请求超时',
      timeoutDescription: '等待单次响应的秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '限流或服务器错误后的额外尝试次数',
      retryUnit: '次',
      reset: '恢复默认设置',
      resetDescription: '偏好将恢复为默认值，已保存的凭据保留。',
      resetSucceeded: '已恢复默认设置'
    }
  }
}
