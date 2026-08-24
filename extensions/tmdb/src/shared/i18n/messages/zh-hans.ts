import type { TmdbMessages } from '../index'

export const zhHans: TmdbMessages = {
  errors: {
    apiKeyMissing: '请先在 TMDB 扩展设置中填写 API Key',
    apiKeyInvalid: 'TMDB 拒绝了该 API Key，请在 TMDB 扩展设置中检查',
    apiKeyRequired: '请输入 TMDB API Key',
    notFound: '该 TMDB 条目不存在',
    rateLimited: 'TMDB 请求过于频繁，请稍后再试',
    rejected: 'TMDB 接口拒绝了本次请求',
    unavailable: 'TMDB 接口暂时不可用',
    networkFailed: 'TMDB 接口网络请求失败',
    operationCancelled: '操作已取消',
    baseUrlInvalid: '请输入 http 或 https 地址',
    idInvalid: ({ value }) => `“${value}”不是有效的 TMDB id`,
    referenceInvalid: ({ value }) =>
      `“${value}”不是有效的 TMDB 引用。请使用 movie:<id>、tv:<id>、tv:<id>:s<季号>、tv:<id>:eg:<剧集组 id>:<分组 id>，或 themoviedb.org 链接。`,
    episodeGroupEmpty: ({ setId }) => `TMDB 剧集组 ${setId} 不包含任何分组`,
    episodeGroupMissing: ({ setId, groupId }) => `TMDB 剧集组 ${setId} 中没有分组 ${groupId}`
  },

  settings: {
    webviewTitle: 'TMDB',
    commandLabel: '设置',
    commandDescription: '配置 TMDB API Key、接口地址与刮削偏好'
  },

  ui: {
    loading: '加载中…',
    unavailable: '无法加载 TMDB 设置',
    saved: '偏好已保存',
    savePreferences: '保存',
    discardChanges: '放弃修改',
    unsavedChanges: '有未保存的修改',
    actionFailed: '操作失败',
    cancel: '取消',
    confirm: '确认',

    credentials: {
      title: 'API Key',
      description: 'TMDB 需要个人密钥，v3 API Key 与 v4 读取令牌均可使用',
      statusLabel: '状态',
      inputLabel: '密钥或令牌',
      inputPlaceholder: '粘贴你的 TMDB 密钥',
      configuredLabel: '已配置',
      missingLabel: '未配置',
      modeApiKey: 'v3 API Key',
      modeBearer: 'v4 读取令牌',
      save: '保存密钥',
      clear: '移除密钥',
      test: '测试连接',
      saveSucceeded: 'API Key 已保存',
      clearSucceeded: 'API Key 已移除',
      testSucceeded: 'TMDB 已接受该 API Key',
      openSettings: '前往 themoviedb.org 申请密钥'
    },

    endpoints: {
      title: '接口地址',
      description: '官方地址不可达时，可改为镜像地址',
      apiBaseUrlLabel: 'API 地址',
      apiBaseUrlDescription: 'TMDB v3 REST 接口根地址',
      imageBaseUrlLabel: '图片地址',
      imageBaseUrlDescription: 'TMDB 图片 CDN 根地址，不含尺寸段',
      restoreDefaults: '恢复官方地址'
    },

    episodeGroups: {
      title: '剧集组',
      description:
        '剧集组是 TMDB 社区为一部剧维护的另一套集数编排，例如长篇的连续绝对集号。默认仍按播出季刮削，剧集组按条目单独选择。',
      stepPaste: '在动漫搜索框里粘贴剧 id、剧集组 id 或任意 themoviedb.org 链接，然后搜索',
      stepPick: '结果会列出该剧的每一季，以及每个剧集组的每个分组。选择条目要采用的分组。',
      stepSwitch:
        '把条目改到另一个分组只是再刮削一次：每集按 TMDB episode id 重新对齐，因此只有集号变化，观看记录不受影响',
      inputsLabel: '搜索框可接受的输入',
      idsLabel: '已知分组时，ID 输入框可接受的输入'
    },

    preferences: {
      title: '偏好',
      description: '对所有 TMDB 搜索与刮削生效',
      includeAdultLabel: '包含成人内容',
      includeAdultDescription: '允许 TMDB 搜索返回被标记为成人的条目',
      timeoutLabel: '请求超时',
      timeoutDescription: '单次 TMDB 响应的等待秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '遇到限流或服务端错误后的额外尝试次数',
      retryUnit: '次',
      reset: '恢复默认设置',
      resetDescription: '接口地址与偏好将恢复为默认值，API Key 会保留',
      resetSucceeded: '已恢复默认设置'
    }
  }
}
