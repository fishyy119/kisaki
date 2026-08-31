import type { YmgalMessages } from '../index'

export const zhHans: YmgalMessages = {
  errors: {
    authFailed: '月幕拒绝了客户端凭证，请在月幕扩展设置中检查',
    credentialRequired: '请同时填写客户端 ID 与客户端密钥',
    notFound: '该月幕档案不存在',
    rateLimited: '月幕请求过于频繁，请稍后再试',
    rejected: '月幕接口拒绝了该请求',
    unavailable: '月幕接口暂时不可用',
    networkFailed: '月幕接口网络请求失败',
    operationCancelled: '操作已取消',
    baseUrlInvalid: '请输入 http 或 https 地址',
    idInvalid: ({ value }) => `“${value}”不是有效的月幕档案 ID`
  },

  settings: {
    webviewTitle: '月幕 Galgame',
    commandLabel: '设置',
    commandDescription: '配置月幕接口客户端、地址与刮削偏好'
  },

  ui: {
    loading: '加载中…',
    unavailable: '无法加载月幕设置',
    savePreferences: '保存',
    discardChanges: '放弃更改',
    unsavedChanges: '有未保存的更改',
    actionFailed: '操作失败',
    cancel: '取消',
    confirm: '确认',

    credentials: {
      title: '接口客户端',
      description:
        '月幕提供公共共享客户端，扩展默认使用它。仅当你申请了专属客户端时才需要填写自己的凭证。',
      statusLabel: '当前客户端',
      sharedLabel: '公共共享客户端',
      customLabel: '你的专属客户端',
      clientIdLabel: '客户端 ID',
      clientIdPlaceholder: '你的月幕客户端 ID',
      clientSecretLabel: '客户端密钥',
      clientSecretPlaceholder: '你的月幕客户端密钥',
      save: '保存客户端',
      clear: '改用共享客户端',
      test: '测试连接',
      testSucceeded: '月幕已接受该接口客户端',
      openDeveloper: '前往 ymgal.games 申请客户端'
    },

    endpoints: {
      title: '接口地址',
      description: '当官方地址不可达时，可指向镜像',
      apiBaseUrlLabel: '接口基础地址',
      apiBaseUrlDescription: '月幕开放接口的根地址',
      restoreDefaults: '恢复官方地址'
    },

    preferences: {
      title: '偏好设置',
      description: '应用于全部月幕搜索与刮削',
      preferChineseLabel: '优先使用中文标题',
      preferChineseDescription: '内容语言为中文时，将中文名作为显示名称',
      timeoutLabel: '请求超时',
      timeoutDescription: '等待单次月幕响应的秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '遇到限流或服务端错误后的额外尝试次数',
      retryUnit: '次',
      reset: '恢复默认设置',
      resetDescription: '地址与偏好恢复默认，客户端凭证保留'
    }
  }
}
