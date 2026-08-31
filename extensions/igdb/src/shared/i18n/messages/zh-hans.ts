import type { IgdbMessages } from '../index'

export const zhHans: IgdbMessages = {
  errors: {
    credentialMissing: '请先在 IGDB 扩展设置中填写 Twitch 客户端 ID 与密钥',
    credentialInvalid: 'Twitch 拒绝了该客户端凭证，请在 IGDB 扩展设置中检查',
    credentialRequired: '请同时填写客户端 ID 与客户端密钥',
    notFound: '该 IGDB 条目不存在',
    rateLimited: 'IGDB 请求过于频繁，请稍后再试',
    rejected: 'IGDB 接口拒绝了该请求',
    unavailable: 'IGDB 接口暂时不可用',
    networkFailed: 'IGDB 接口网络请求失败',
    operationCancelled: '操作已取消',
    baseUrlInvalid: '请输入 http 或 https 地址',
    idInvalid: ({ value }) => `“${value}”不是有效的 IGDB ID`
  },

  settings: {
    webviewTitle: 'IGDB',
    commandLabel: '设置',
    commandDescription: '配置 IGDB 认证所用的 Twitch 客户端与接口地址'
  },

  ui: {
    loading: '加载中…',
    unavailable: '无法加载 IGDB 设置',
    savePreferences: '保存',
    discardChanges: '放弃更改',
    unsavedChanges: '有未保存的更改',
    actionFailed: '操作失败',
    cancel: '取消',
    confirm: '确认',

    credentials: {
      title: 'Twitch 客户端',
      description:
        'IGDB 通过 Twitch 认证。请在 Twitch 开发者控制台注册应用，并填写其客户端 ID 与密钥。',
      statusLabel: '状态',
      clientIdLabel: '客户端 ID',
      clientIdPlaceholder: '你的 Twitch 客户端 ID',
      clientSecretLabel: '客户端密钥',
      clientSecretPlaceholder: '你的 Twitch 客户端密钥',
      configuredLabel: '已配置',
      missingLabel: '未配置',
      save: '保存客户端',
      clear: '移除客户端',
      test: '测试连接',
      testSucceeded: 'Twitch 已接受该客户端凭证',
      openConsole: '前往 dev.twitch.tv 注册应用'
    },

    endpoints: {
      title: '接口地址',
      description: '当官方地址不可达时，可指向镜像',
      apiBaseUrlLabel: '接口基础地址',
      apiBaseUrlDescription: 'IGDB v4 接口的根地址',
      oauthUrlLabel: 'OAuth 令牌地址',
      oauthUrlDescription: '签发客户端凭证令牌的 Twitch 端点',
      restoreDefaults: '恢复官方地址'
    },

    preferences: {
      title: '偏好设置',
      description: '应用于全部 IGDB 搜索与刮削',
      timeoutLabel: '请求超时',
      timeoutDescription: '等待单次 IGDB 响应的秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '遇到限流或服务端错误后的额外尝试次数',
      retryUnit: '次',
      reset: '恢复默认设置',
      resetDescription: '地址与偏好恢复默认，Twitch 客户端保留'
    }
  }
}
