import type { SgdbMessages } from '../index'

export const zhHans: SgdbMessages = {
  errors: {
    keyRequired: '请先保存 SteamGridDB API 密钥',
    keyRejected: 'SteamGridDB 拒绝了该 API 密钥',
    notFound: '该 SteamGridDB 条目不存在',
    rateLimited: '对 SteamGridDB 的请求过于频繁，请稍后重试。',
    rejected: 'SteamGridDB API 拒绝了请求',
    unavailable: 'SteamGridDB API 暂时不可用',
    networkFailed: '对 SteamGridDB 的网络请求失败',
    operationCancelled: '操作已取消',
    idInvalid: ({ value }) => `“${value}”不是有效的 SteamGridDB ID`,
    keyEmpty: '请输入 API 密钥'
  },

  settings: {
    webviewTitle: 'SteamGridDB',
    commandLabel: '设置',
    commandDescription: '配置 SteamGridDB API 密钥与美术偏好'
  },

  ui: {
    loading: '加载中…',
    unavailable: '无法加载 SteamGridDB 设置',
    saved: '设置已保存',
    savePreferences: '保存',
    discardChanges: '放弃',
    unsavedChanges: '有未保存的更改',
    actionFailed: '操作失败',
    cancel: '取消',
    confirm: '确认',

    account: {
      title: 'API 密钥',
      description: 'SteamGridDB 需要免费的个人 API 密钥。保存时会通过一次探测请求验证。',
      statusLabel: '状态',
      configuredLabel: '已保存密钥',
      missingLabel: '未保存密钥',
      keyLabel: 'API 密钥',
      keyPlaceholder: '粘贴 API 密钥',
      saveKey: '保存密钥',
      clearKey: '移除密钥',
      openKeyPage: '获取 API 密钥'
    },

    preferences: {
      title: '偏好',
      description: '作用于所有美术请求',
      includeNsfwLabel: '包含 NSFW 美术',
      includeNsfwDescription: '同时返回社区标记为 NSFW 的美术',
      timeoutLabel: '请求超时',
      timeoutDescription: '等待单次响应的秒数',
      seconds: '秒',
      retryLabel: '重试次数',
      retryDescription: '限流或服务器错误后的额外尝试次数',
      retryUnit: '次',
      reset: '恢复默认设置',
      resetDescription: '偏好将恢复为默认值，已保存的密钥保留。',
      resetSucceeded: '已恢复默认设置'
    }
  }
}
