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

    account: {
      title: '账号',
      description: '通过浏览器登录以连接 MyAnimeList 列表。登录直连 MyAnimeList，令牌会自动刷新。',
      statusLabel: '状态',
      configuredLabel: '已登录',
      missingLabel: '未登录',
      pendingLabel: '等待浏览器登录…',
      login: '使用 MyAnimeList 登录',
      cancelLogin: '取消登录',
      logout: '退出登录',
      verify: '验证账号',
      verifiedAs: ({ userName }) => `已以 ${userName} 的身份登录`
    },

    integration: {
      title: '列表联动',
      syncEnabledLabel: '自动推送变更',
      syncEnabledDescription: '将带有 MyAnimeList ID 条目的状态与评分变更推送到列表',
      pushScoreLabel: '包含评分',
      pushScoreDescription: '将本地评分写入 MyAnimeList。本地评分为空时不会清除远端评分。',
      pushAll: '立即全量推送',
      importTitle: '导入列表',
      importDescription:
        '将列表状态与评分写入匹配的条目。创建缺失条目时会经所选配置刮削完整元数据。',
      listAnime: '动画列表',
      listManga: '漫画列表',
      updateExistingLabel: '更新已有条目',
      createMissingLabel: '创建缺失条目',
      animeProfileLabel: '动画配置',
      comicProfileLabel: '漫画配置',
      novelProfileLabel: '小说配置',
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
      description: '官方 API 根地址与 Jikan 兼容元数据镜像',
      apiUrlLabel: 'API 地址',
      apiUrlDescription: 'MyAnimeList 官方 API v2 的根地址',
      mirrorEnabledLabel: '使用元数据镜像',
      mirrorEnabledDescription: '角色、工作人员与剧集数据来自镜像；关闭后这些槽位保持缺席',
      mirrorUrlLabel: '镜像地址',
      mirrorUrlDescription: 'Jikan v4 兼容 API 的根地址，如 Tenrai 或自托管 Jikan',
      restoreDefaults: '恢复官方端点'
    },

    preferences: {
      title: '偏好',
      description: '作用于所有 MyAnimeList 搜索与刮削',
      preferRomajiLabel: '优先罗马字标题',
      preferRomajiDescription: '当没有匹配内容语言的标题时，使用罗马字标题作为显示名称',
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
