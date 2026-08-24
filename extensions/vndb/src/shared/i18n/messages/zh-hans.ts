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
    idInvalid: ({ value }) => `“${value}”不是有效的 VNDB ID`
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

    credentials: {
      title: '接口令牌',
      description: 'Kana 接口开放访问，无需令牌即可刮削。填写个人令牌可提高速率上限。',
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
      openSettings: '前往 vndb.org 创建令牌'
    },

    endpoints: {
      title: '接口地址',
      description: '当官方地址不可达时，可指向镜像',
      apiBaseUrlLabel: '接口基础地址',
      apiBaseUrlDescription: 'VNDB Kana 接口的根地址',
      restoreDefaults: '恢复官方地址'
    },

    preferences: {
      title: '偏好设置',
      description: '应用于全部 VNDB 搜索与刮削',
      preferRomanizedLabel: '优先使用罗马字标题',
      preferRomanizedDescription: '当内容语言没有对应标题时，使用罗马字标题作为显示名称',
      timeoutLabel: '请求超时',
      timeoutDescription: '等待单次 VNDB 响应的秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '遇到限流或服务端错误后的额外尝试次数',
      retryUnit: '次',
      reset: '恢复默认设置',
      resetDescription: '地址与偏好恢复默认，令牌保留',
      resetSucceeded: '已恢复默认设置'
    }
  }
}
