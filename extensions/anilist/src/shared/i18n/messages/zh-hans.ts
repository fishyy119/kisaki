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

    account: {
      title: '账号',
      description: '通过浏览器登录以连接你的 AniList 列表。令牌约一年有效，且无法续期。',
      statusLabel: '状态',
      configuredLabel: '已登录',
      missingLabel: '未登录',
      pendingLabel: '等待浏览器登录…',
      login: '使用 AniList 登录',
      completeLogin: '我已完成授权',
      cancelLogin: '取消登录',
      logout: '退出登录',
      verify: '验证账号',
      verifiedAs: ({ userName }) => `已登录为 ${userName}`
    },

    integration: {
      title: '列表集成',
      syncEnabledLabel: '自动推送更改',
      syncEnabledDescription: '带 AniList ID 的条目的状态与评分修改会推送到你的列表',
      pushScoreLabel: '包含评分',
      pushScoreDescription: '将本地评分写入 AniList；本地评分为空时不会清除远端评分',
      pushAll: '立即全量推送',
      importTitle: '导入列表',
      importDescription: '将列表状态与评分写入匹配的条目。新建缺失条目时通过所选配置刮削。',
      listAnime: '动画列表',
      listManga: '漫画列表',
      updateExistingLabel: '更新已有条目',
      createMissingLabel: '新建缺失条目',
      animeProfileLabel: '动画配置',
      comicProfileLabel: '漫画配置',
      novelProfileLabel: '小说配置',
      profilePlaceholder: '选择配置',
      startImport: '导入',
      taskProgress: ({ current, total }) => `${current} / ${total}`,
      taskRunning: '运行中',
      taskCompleted: '已完成',
      taskFailed: '已失败',
      taskCancelled: '已取消',
      cancelTask: '取消'
    },

    endpoints: {
      title: '接口地址',
      description: '当官方地址不可达时，可指向镜像',
      graphqlUrlLabel: 'GraphQL 地址',
      graphqlUrlDescription: 'AniList GraphQL 接口的根地址',
      relayUrlLabel: 'OAuth 中继地址',
      relayUrlDescription: '完成 AniList 登录的 Kisaki 中继路由',
      restoreDefaults: '恢复官方地址'
    },

    preferences: {
      title: '偏好设置',
      description: '应用于全部 AniList 搜索与刮削',
      preferRomajiLabel: '优先使用罗马字标题',
      preferRomajiDescription: '当内容语言没有对应标题时，使用罗马字标题作为显示名称',
      timeoutLabel: '请求超时',
      timeoutDescription: '等待单次 AniList 响应的秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '遇到限流或服务端错误后的额外尝试次数',
      retryUnit: '次',
      reset: '恢复默认设置',
      resetDescription: '地址与偏好恢复默认，登录保留',
      resetSucceeded: '已恢复默认设置'
    }
  }
}
